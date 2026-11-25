import fs from "fs";
import path from "path";
import { compass } from "./format";
import { haversineKm } from "./geo";
import { tideFeet } from "./tide-model";
import type { Forecast, HourPoint, TideTrend } from "./types";

const NOAA_RADIUS_KM = 120;
const USER_AGENT = "Surfing/1.0 (public forecast; https://github.com/mbboisvert/surfing)";

type Station = { id: string; name: string; lat: number; lng: number };

type MarineResponse = {
  error?: boolean;
  utc_offset_seconds?: number;
  timezone?: string;
  timezone_abbreviation?: string;
  hourly?: {
    time: string[];
    swell_wave_height: Array<number | null>;
    swell_wave_period: Array<number | null>;
    swell_wave_direction: Array<number | null>;
    wave_height: Array<number | null>;
    wave_period: Array<number | null>;
    wave_direction: Array<number | null>;
  };
};

type WindResponse = {
  hourly?: {
    time: string[];
    wind_speed_10m: Array<number | null>;
    wind_direction_10m: Array<number | null>;
  };
};

type TideSeries = {
  source: string;
  datum: string;
  sample: (utcMs: number) => { feet: number | null; trend: TideTrend | null };
};

let stationsCache: Station[] | null = null;
const forecastCache = new Map<string, { at: number; body: Forecast }>();
const FORECAST_TTL_MS = 30 * 60 * 1000;

function stations(): Station[] {
  if (!stationsCache) {
    const file = path.join(process.cwd(), "data", "noaa-stations.json");
    stationsCache = JSON.parse(fs.readFileSync(file, "utf8")) as Station[];
  }
  return stationsCache;
}

function nearestStation(lat: number, lon: number): { station: Station; km: number } | null {
  let best: { station: Station; km: number } | null = null;
  for (const station of stations()) {
    const km = haversineKm(lat, lon, station.lat, station.lng);
    if (!best || km < best.km) best = { station, km };
  }
  if (!best || best.km > NOAA_RADIUS_KM) return null;
  return best;
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`status ${response.status}`);
  return response.json();
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function noaaUrl(id: string, begin: Date, end: Date): string {
  const query = new URLSearchParams({
    begin_date: ymd(begin),
    end_date: ymd(end),
    station: id,
    product: "predictions",
    datum: "MLLW",
    time_zone: "gmt",
    interval: "h",
    units: "english",
    format: "json",
  });
  return `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${query}`;
}

function parseNoaa(payload: unknown): Map<number, number> | null {
  const predictions = (payload as { predictions?: Array<{ t: string; v: string }> }).predictions;
  if (!Array.isArray(predictions) || predictions.length === 0) return null;
  const heights = new Map<number, number>();
  for (const row of predictions) {
    const ms = Date.parse(`${row.t.replace(" ", "T")}Z`);
    const feet = Number(row.v);
    if (!Number.isFinite(ms) || !Number.isFinite(feet)) continue;
    heights.set(Math.floor(ms / 3600000), feet);
  }
  return heights.size ? heights : null;
}

async function loadTide(lat: number, lon: number): Promise<TideSeries> {
  const near = nearestStation(lat, lon);
  if (near) {
    try {
      const payload = await getJson(
        noaaUrl(near.station.id, new Date(Date.now() - 3 * 3600_000), new Date(Date.now() + 60 * 3600_000)),
      );
      const heights = parseNoaa(payload);
      if (heights) {
        return {
          source: `NOAA ${near.station.name}`,
          datum: "MLLW",
          sample(utcMs) {
            const hour = Math.floor(utcMs / 3600000);
            const feet = heights.get(hour) ?? null;
            const next = heights.get(hour + 1);
            let trend: TideTrend | null = null;
            if (feet != null && next != null) {
              const delta = next - feet;
              trend = delta > 0.08 ? "rising" : delta < -0.08 ? "falling" : "steady";
            }
            return { feet, trend };
          },
        };
      }
    } catch (error) {
      console.error("NOAA tide failed", error);
    }
  }
  return {
    source: "Harmonic model",
    datum: "mean sea level, approximate",
    sample(utcMs) {
      const feet = tideFeet(lat, lon, new Date(utcMs));
      return { feet: Number.isFinite(feet) ? feet : null, trend: null };
    },
  };
}

function marineUrl(lat: number, lon: number): string {
  const query = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: "swell_wave_height,swell_wave_period,swell_wave_direction,wave_height,wave_period,wave_direction",
    length_unit: "imperial",
    timezone: "auto",
    forecast_days: "4",
  });
  return `https://marine-api.open-meteo.com/v1/marine?${query}`;
}

function windUrl(lat: number, lon: number, seaCell: boolean): string {
  const query = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: "wind_speed_10m,wind_direction_10m",
    wind_speed_unit: "kn",
    timezone: "auto",
    forecast_days: "4",
  });
  if (seaCell) query.set("cell_selection", "sea");
  return `https://api.open-meteo.com/v1/forecast?${query}`;
}

async function loadWind(lat: number, lon: number): Promise<WindResponse | null> {
  try {
    return (await getJson(windUrl(lat, lon, true))) as WindResponse;
  } catch (error) {
    console.error("sea wind failed", error);
  }
  try {
    return (await getJson(windUrl(lat, lon, false))) as WindResponse;
  } catch (error) {
    console.error("wind failed", error);
    return null;
  }
}

function weekday(dayKey: string): string {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names[new Date(`${dayKey}T00:00:00Z`).getUTCDay()] ?? dayKey;
}

function pickWave(
  swellH: number | null,
  swellP: number | null,
  swellD: number | null,
  waveH: number | null,
  waveP: number | null,
  waveD: number | null,
): { height: number | null; period: number | null; direction: number | null; kind: "swell" | "waves" } {
  if (swellH != null && swellH >= 0.3 && (waveH == null || swellH >= waveH * 0.35)) {
    return { height: swellH, period: swellP, direction: swellD, kind: "swell" };
  }
  if (waveH != null) return { height: waveH, period: waveP, direction: waveD, kind: "waves" };
  return { height: swellH, period: swellP, direction: swellD, kind: "swell" };
}

async function buildForecast(lat: number, lon: number): Promise<Forecast> {
  const [marineRaw, wind, tide] = await Promise.all([
    getJson(marineUrl(lat, lon)) as Promise<MarineResponse>,
    loadWind(lat, lon),
    loadTide(lat, lon),
  ]);
  if (marineRaw.error || !marineRaw.hourly?.time?.length) throw new Error("marine forecast missing");
  const marine = marineRaw;
  const hourly = marine.hourly;
  if (!hourly) throw new Error("marine forecast missing");

  const offset = marine.utc_offset_seconds ?? 0;
  const nowLocalMs = Date.now() + offset * 1000;
  const today = new Date(nowLocalMs).toISOString().slice(0, 10);
  const tomorrow = new Date(nowLocalMs + 86_400_000).toISOString().slice(0, 10);
  const windByTime = new Map<string, { kt: number | null; deg: number | null }>();
  wind?.hourly?.time?.forEach((time, index) => {
    windByTime.set(time, {
      kt: finite(wind.hourly?.wind_speed_10m[index]),
      deg: finite(wind.hourly?.wind_direction_10m[index]),
    });
  });

  const hours: HourPoint[] = [];
  for (let index = 0; index < hourly.time.length; index++) {
    const time = hourly.time[index];
    if (!time) continue;
    const wallMs = Date.parse(`${time}Z`);
    if (!Number.isFinite(wallMs) || wallMs + 3_600_000 <= nowLocalMs) continue;
    if (hours.length >= 48) break;
    const wave = pickWave(
      finite(hourly.swell_wave_height[index]),
      finite(hourly.swell_wave_period[index]),
      finite(hourly.swell_wave_direction[index]),
      finite(hourly.wave_height[index]),
      finite(hourly.wave_period[index]),
      finite(hourly.wave_direction[index]),
    );
    const windNow = windByTime.get(time) ?? { kt: null, deg: null };
    const tideNow = tide.sample(wallMs - offset * 1000);
    const hourNum = Number(time.slice(11, 13));
    const dayKey = time.slice(0, 10);
    hours.push({
      time,
      day: dayKey === today ? "Today" : dayKey === tomorrow ? "Tomorrow" : weekday(dayKey),
      label: `${hourNum % 12 || 12} ${hourNum < 12 ? "AM" : "PM"}`,
      swellFt: wave.height,
      periodS: wave.period,
      directionDeg: wave.direction,
      direction: wave.direction == null ? null : compass(wave.direction),
      windKt: windNow.kt,
      windDeg: windNow.deg,
      windDirection: windNow.deg == null ? null : compass(windNow.deg),
      tideFt: tideNow.feet,
      tideTrend: tideNow.trend,
      kind: wave.kind,
    });
  }
  if (!hours.length) throw new Error("no forecast hours");
  return {
    timezone: marine.timezone ?? "UTC",
    timezoneAbbreviation: marine.timezone_abbreviation ?? "",
    hours,
    tideSource: tide.source,
    tideDatum: tide.datum,
  };
}

export async function forecastAt(lat: number, lon: number): Promise<Forecast> {
  const latR = Math.round(lat * 50) / 50;
  const lonR = Math.round(lon * 50) / 50;
  const key = `${latR.toFixed(2)},${lonR.toFixed(2)}`;
  const hit = forecastCache.get(key);
  if (hit && Date.now() - hit.at < FORECAST_TTL_MS) return hit.body;
  const body = await buildForecast(latR, lonR);
  forecastCache.set(key, { at: Date.now(), body });
  return body;
}
