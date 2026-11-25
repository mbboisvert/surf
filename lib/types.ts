export type BreakSpot = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  place: string;
  facing: number | null;
  cam: string | null;
};

export type TideTrend = "rising" | "falling" | "steady";

export type HourPoint = {
  time: string;
  day: string;
  label: string;
  swellFt: number | null;
  periodS: number | null;
  directionDeg: number | null;
  direction: string | null;
  windKt: number | null;
  windDeg: number | null;
  windDirection: string | null;
  tideFt: number | null;
  tideTrend: TideTrend | null;
  kind: "swell" | "waves";
};

export type Forecast = {
  timezone: string;
  timezoneAbbreviation: string;
  hours: HourPoint[];
  tideSource: string;
  tideDatum: string;
};

export type NewsItem = {
  title: string;
  url: string;
  date: string | null;
  excerpt: string;
};

export type NewsSource = {
  id: string;
  name: string;
  items: NewsItem[];
  error?: string;
};
