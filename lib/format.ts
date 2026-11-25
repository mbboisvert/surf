const POINTS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

export function compass(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return POINTS[index] ?? "N";
}

export function formatFt(feet: number): string {
  if (!Number.isFinite(feet)) return "—";
  return `${feet.toFixed(1)} ft`;
}

export function formatKt(knots: number): string {
  if (!Number.isFinite(knots)) return "—";
  return `${Math.round(knots)} kt`;
}

export function formatPeriod(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";
  const rounded = Math.round(seconds * 10) / 10;
  const text = Math.abs(rounded - Math.round(rounded)) < 0.05 ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${text} s`;
}

export function formatMiles(miles: number): string {
  if (!Number.isFinite(miles)) return "—";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
