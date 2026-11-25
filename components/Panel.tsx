"use client";

import { useEffect, useState } from "react";
import { formatFt, formatKt, formatMiles, formatPeriod } from "@/lib/format";
import { scoreConditions } from "@/lib/score";
import type { BreakSpot, Forecast, HourPoint } from "@/lib/types";

type Near = { spot: BreakSpot; miles: number };

function reading(hour: HourPoint | undefined, facing: number | null) {
  if (!hour || hour.swellFt == null || hour.periodS == null || hour.windKt == null) {
    return { score: null as number | null, why: null as string | null };
  }
  return scoreConditions({
    heightFt: hour.swellFt,
    periodS: hour.periodS,
    windKt: hour.windKt,
    windFromDeg: hour.windDeg,
    facingDeg: facing,
    kind: hour.kind,
  });
}

function Arrow({ degrees }: { degrees: number }) {
  const travel = (degrees + 180) % 360;
  return (
    <svg className="arrow" viewBox="0 0 12 12" style={{ transform: `rotate(${travel}deg)` }} aria-hidden>
      <path d="M6 10.5V2.5 M6 2.5 3.6 5 M6 2.5 8.4 5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function DayAxis({ hours }: { hours: HourPoint[] }) {
  const groups: { day: string; count: number }[] = [];
  for (const hour of hours) {
    const last = groups[groups.length - 1];
    if (last && last.day === hour.day) last.count += 1;
    else groups.push({ day: hour.day, count: 1 });
  }
  const total = hours.length || 1;
  return (
    <div className="days">
      {groups.map((group, groupIndex) => (
        <span key={`${group.day}-${groupIndex}`} style={{ flexGrow: group.count }}>
          {group.count / total >= 0.16 ? group.day : ""}
        </span>
      ))}
    </div>
  );
}

function HourChart({
  hours,
  index,
  onPick,
}: {
  hours: HourPoint[];
  index: number;
  onPick: (index: number) => void;
}) {
  const max = Math.max(1, ...hours.map((hour) => hour.swellFt ?? 0));
  return (
    <div className="chart-wrap">
      <div className="chart" role="listbox" aria-label="Next 48 hours">
        {hours.map((hour, hourIndex) => (
          <button
            key={hour.time}
            type="button"
            role="option"
            aria-selected={hourIndex === index}
            className="bar"
            style={{ height: `${Math.max(6, ((hour.swellFt ?? 0) / max) * 100)}%` }}
            onClick={() => onPick(hourIndex)}
            aria-label={`${hour.day} ${hour.label}, ${hour.swellFt == null ? "no height" : formatFt(hour.swellFt)}`}
          />
        ))}
      </div>
      <DayAxis hours={hours} />
    </div>
  );
}

function ForecastDetail({
  spot,
  miles,
  forecast,
  error,
  onBack,
  onClose,
  onRetry,
}: {
  spot: BreakSpot;
  miles: number;
  forecast: Forecast | undefined;
  error: string | undefined;
  onBack: () => void;
  onClose: () => void;
  onRetry: () => void;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
  }, [spot.id]);
  const hour = forecast?.hours[index] ?? forecast?.hours[0];
  const scored = reading(hour, spot.facing);
  const when = index === 0 || !hour ? "Now" : `${hour.day}, ${hour.label}`;
  const zone = forecast?.timezoneAbbreviation;

  return (
    <>
      <div className="detail-top">
        <button type="button" className="back" onClick={onBack}>
          Five nearest
        </button>
        <button type="button" className="close" onClick={onClose}>
          Close
        </button>
      </div>
      <h2>{spot.name}</h2>
      <p className="place-line">
        {[spot.place, formatMiles(miles)].filter(Boolean).join(" · ")}
      </p>
      {error ? (
        <p className="why">
          {error}{" "}
          <button type="button" className="retry" onClick={onRetry}>
            Try again
          </button>
        </p>
      ) : (
        <>
          <div className="score-row">
            <p className="score">
              {scored.score ?? "–"}
              <span>/10</span>
            </p>
            <p className="why">
              {scored.why ??
                (forecast
                  ? hour?.swellFt == null
                    ? "No swell data at this point."
                    : "Conditions are incomplete."
                  : "Loading conditions.")}
            </p>
          </div>
          {hour ? (
            <>
              <p className="when">
                {when}
                {zone ? <span> · {zone}</span> : null}
              </p>
              <dl className="readout">
                <div>
                  <dt>{hour.kind === "waves" ? "Waves" : "Swell"}</dt>
                  <dd>{hour.swellFt == null ? "—" : formatFt(hour.swellFt)}</dd>
                </div>
                <div>
                  <dt>Period</dt>
                  <dd>{hour.periodS == null ? "—" : formatPeriod(hour.periodS)}</dd>
                </div>
                <div>
                  <dt>Direction</dt>
                  <dd>
                    {hour.direction ?? "—"}
                    {hour.directionDeg != null ? (
                      <>
                        {" "}
                        {Math.round(hour.directionDeg)}°
                        <Arrow degrees={hour.directionDeg} />
                      </>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>Wind</dt>
                  <dd>
                    {hour.windKt == null ? "—" : formatKt(hour.windKt)}
                    {hour.windDirection ? ` ${hour.windDirection}` : ""}
                    {hour.windDeg != null ? <Arrow degrees={hour.windDeg} /> : null}
                  </dd>
                </div>
                <div>
                  <dt>Tide</dt>
                  <dd>
                    {hour.tideFt == null ? "—" : formatFt(hour.tideFt)}
                    {hour.tideTrend ? ` · ${hour.tideTrend}` : ""}
                  </dd>
                </div>
              </dl>
              {forecast ? <HourChart hours={forecast.hours} index={index} onPick={setIndex} /> : null}
              {forecast ? (
                <p className="source">
                  Open-Meteo · {forecast.tideSource} · {forecast.tideDatum}
                </p>
              ) : null}
            </>
          ) : null}
          {spot.cam ? (
            <a className="cam" href={spot.cam} target="_blank" rel="noopener noreferrer">
              Camera
            </a>
          ) : null}
        </>
      )}
    </>
  );
}

export function Panel({
  nearest,
  forecasts,
  errors,
  selectedId,
  onSelect,
  onBack,
  onClose,
  onRetry,
}: {
  nearest: Near[];
  forecasts: Record<string, Forecast>;
  errors: Record<string, string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  onClose: () => void;
  onRetry: (id: string) => void;
}) {
  const selected = nearest.find((row) => row.spot.id === selectedId);
  return (
    <aside className="panel" data-mode={selected ? "detail" : "list"} aria-live="polite">
      <div className="handle" aria-hidden />
      {selected ? (
        <ForecastDetail
          spot={selected.spot}
          miles={selected.miles}
          forecast={forecasts[selected.spot.id]}
          error={errors[selected.spot.id]}
          onBack={onBack}
          onClose={onClose}
          onRetry={() => onRetry(selected.spot.id)}
        />
      ) : (
        <>
          <div className="panel-top">
            <h2>Five nearest</h2>
            <button type="button" className="close" onClick={onClose}>
              Close
            </button>
          </div>
          {nearest.map((row) => {
            const forecast = forecasts[row.spot.id];
            const hour = forecast?.hours[0];
            const scored = reading(hour, row.spot.facing);
            const condition =
              hour && hour.swellFt != null && hour.periodS != null
                ? `${formatFt(hour.swellFt)} · ${formatPeriod(hour.periodS)}`
                : errors[row.spot.id]
                  ? "Unavailable"
                  : forecast
                    ? "No swell"
                    : "";
            return (
              <button key={row.spot.id} type="button" className="spot" onClick={() => onSelect(row.spot.id)}>
                <span className="spot-name">{row.spot.name}</span>
                <span className="spot-score">{scored.score ?? "–"}</span>
                <span className="spot-meta">
                  {[row.spot.place, formatMiles(row.miles)].filter(Boolean).join(" · ")}
                </span>
                {condition ? <span className="spot-cond">{condition}</span> : <span className="spot-cond"> </span>}
              </button>
            );
          })}
          <p className="credit">Breaks © OpenStreetMap</p>
        </>
      )}
    </aside>
  );
}
