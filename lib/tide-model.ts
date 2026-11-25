/**
 * Global tide estimate used where no NOAA station is close.
 *
 * Four constituents (M2, S2, N2, K1, O1). Equilibrium amplitudes follow the
 * usual latitude functions, then a regional factor scales them toward the
 * tide people actually see on that shelf. Timing is the equilibrium argument
 * plus longitude, so the clock can be off where the ocean's phase lag is large.
 * Heights are relative to mean sea level. Nodal modulation is omitted; the
 * spring-neap cycle still comes from M2 and S2.
 */

type Region = {
  name: string;
  lat0: number;
  lat1: number;
  lon0: number;
  lon1: number;
  semi: number;
  diurnal: number;
};

const REGIONS: Region[] = [
  { name: "Mediterranean", lat0: 30, lat1: 46, lon0: -6, lon1: 36, semi: 0.55, diurnal: 0.45 },
  { name: "Baltic", lat0: 53, lat1: 66, lon0: 10, lon1: 30, semi: 0.25, diurnal: 0.35 },
  { name: "Gulf of Mexico", lat0: 18, lat1: 31, lon0: -98, lon1: -81, semi: 0.7, diurnal: 3.2 },
  { name: "Bay of Fundy", lat0: 43.5, lat1: 48.5, lon0: -71, lon1: -63, semi: 20, diurnal: 2.5 },
  { name: "UK and Ireland", lat0: 49, lat1: 61, lon0: -11, lon1: 2, semi: 15, diurnal: 1.8 },
  { name: "North Sea", lat0: 51, lat1: 59, lon0: 2, lon1: 9, semi: 8, diurnal: 1.6 },
  { name: "Bay of Biscay", lat0: 43, lat1: 48.5, lon0: -5, lon1: 0.5, semi: 8, diurnal: 1.4 },
  { name: "Portugal and Galicia", lat0: 36.8, lat1: 44, lon0: -11, lon1: -6, semi: 7, diurnal: 1.3 },
  { name: "Morocco", lat0: 28, lat1: 36.5, lon0: -13, lon1: -5, semi: 5.5, diurnal: 1.2 },
  { name: "Patagonia", lat0: -55, lat1: -40, lon0: -74, lon1: -62, semi: 9, diurnal: 2 },
  { name: "Indonesia", lat0: -11, lat1: 6, lon0: 95, lon1: 141, semi: 2.4, diurnal: 3.2 },
  { name: "North Australia", lat0: -18, lat1: -10, lon0: 122, lon1: 146, semi: 6, diurnal: 4 },
  { name: "West Australia", lat0: -36, lat1: -20, lon0: 112, lon1: 124, semi: 1.3, diurnal: 1.1 },
  { name: "East Australia", lat0: -39, lat1: -24, lon0: 148, lon1: 154, semi: 3.4, diurnal: 1.8 },
  { name: "South Africa", lat0: -36, lat1: -30, lon0: 16, lon1: 33, semi: 3.6, diurnal: 1.4 },
  { name: "Chile", lat0: -46, lat1: -18, lon0: -76, lon1: -70, semi: 3, diurnal: 1.4 },
  { name: "Peru and Ecuador", lat0: -18, lat1: 2, lon0: -82, lon1: -70, semi: 2, diurnal: 1 },
  { name: "Japan", lat0: 30, lat1: 46, lon0: 129, lon1: 146, semi: 3, diurnal: 2.4 },
  { name: "Hawaii", lat0: 18, lat1: 23, lon0: -161, lon1: -154, semi: 1.5, diurnal: 1.1 },
  { name: "Caribbean", lat0: 9, lat1: 23, lon0: -90, lon1: -59, semi: 1.1, diurnal: 1.4 },
  { name: "US West Coast", lat0: 22, lat1: 49, lon0: -125, lon1: -116, semi: 4.2, diurnal: 2.2 },
  { name: "US East Coast", lat0: 24, lat1: 46, lon0: -82, lon1: -66, semi: 3.5, diurnal: 2 },
];

const DEFAULT_REGION: Region = {
  name: "Ocean",
  lat0: -90,
  lat1: 90,
  lon0: -180,
  lon1: 180,
  semi: 3,
  diurnal: 1.6,
};

const LUNAR_LONGITUDE = [218.3164477, 481267.88123421, -0.0015786, 1 / 538841, -1 / 65194000];
const SOLAR_LONGITUDE = [280.46646, 36000.76983, 0.0003032];
const LUNAR_PERIGEE = [83.3532465, 4069.0137287, -0.01032, -1 / 80053, 1 / 18999000];

function poly(coefficients: number[], t: number): number {
  let value = 0;
  for (let i = coefficients.length - 1; i >= 0; i--) {
    value = value * t + (coefficients[i] ?? 0);
  }
  return value;
}

function julianDate(date: Date): number {
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  const day =
    date.getUTCDate() +
    (date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) / 24;
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const century = Math.floor(year / 100);
  const gregorian = 2 - century + Math.floor(century / 4);
  return (
    Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + gregorian - 1524.5
  );
}

function contains(region: Region, lat: number, lon: number): boolean {
  if (lat < region.lat0 || lat > region.lat1) return false;
  if (region.lon0 <= region.lon1) return lon >= region.lon0 && lon <= region.lon1;
  return lon >= region.lon0 || lon <= region.lon1;
}

function regionAt(lat: number, lon: number): Region {
  return REGIONS.find((region) => contains(region, lat, lon)) ?? DEFAULT_REGION;
}

function localArgument(greenwichDegrees: number, species: number, longitude: number): number {
  return ((greenwichDegrees + species * longitude) * Math.PI) / 180;
}

/** Tide height in feet, relative to mean sea level. */
export function tideFeet(lat: number, lon: number, date: Date): number {
  const jd = julianDate(date);
  const centuries = (jd - 2451545) / 36525;
  const moon = poly(LUNAR_LONGITUDE, centuries);
  const sun = poly(SOLAR_LONGITUDE, centuries);
  const perigee = poly(LUNAR_PERIGEE, centuries);
  const hour = (jd - Math.floor(jd)) * 360;
  const hourAngle = hour + sun - moon;
  const region = regionAt(lat, lon);
  const phi = (lat * Math.PI) / 180;
  const cos2 = Math.cos(phi) ** 2;
  const sin2 = Math.sin(2 * phi);
  const m2 = 0.242334 * cos2 * region.semi;
  const s2 = 0.112841 * cos2 * region.semi;
  const n2 = 0.046398 * cos2 * region.semi;
  const k1 = 0.141565 * sin2 * region.diurnal;
  const o1 = 0.100514 * sin2 * region.diurnal;
  const meters =
    m2 * Math.cos(localArgument(2 * hourAngle, 2, lon)) +
    s2 * Math.cos(localArgument(2 * hourAngle + 2 * moon - 2 * sun, 2, lon)) +
    n2 * Math.cos(localArgument(2 * hourAngle - moon + perigee, 2, lon)) +
    k1 * Math.cos(localArgument(hourAngle + moon - 90, 1, lon)) +
    o1 * Math.cos(localArgument(hourAngle - moon + 90, 1, lon));
  return meters * 3.28084;
}
