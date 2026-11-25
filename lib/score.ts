export type Aspect = "offshore" | "cross" | "onshore";

export type ScoreInput = {
  heightFt: number;
  periodS: number;
  windKt: number;
  windFromDeg?: number | null;
  facingDeg?: number | null;
  kind?: "swell" | "waves";
};

const HEIGHT: Array<[number, number]> = [
  [0, 0.5],
  [1, 2],
  [2, 4],
  [3, 7],
  [4.5, 9.5],
  [6, 10],
  [8, 8.5],
  [11, 6.5],
  [15, 4],
  [20, 2],
];

const PERIOD: Array<[number, number]> = [
  [5, 1.5],
  [7, 3],
  [9, 5],
  [11, 7],
  [13, 8.7],
  [15, 9.6],
  [18, 10],
];

const WIND: Array<[number, number]> = [
  [0, 10],
  [5, 9.4],
  [8, 8.2],
  [12, 6],
  [16, 4],
  [20, 2.6],
  [28, 1.2],
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function interp(x: number, points: Array<[number, number]>): number {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return 0;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const left = points[i - 1];
    const right = points[i];
    if (!left || !right || x > right[0]) continue;
    const span = right[0] - left[0];
    const t = span === 0 ? 0 : (x - left[0]) / span;
    return left[1] + t * (right[1] - left[1]);
  }
  return last[1];
}

export function angleDelta(a: number, b: number): number {
  const delta = Math.abs(a - b) % 360;
  return delta > 180 ? 360 - delta : delta;
}

/** Facing is the direction from the break toward the ocean. Wind degrees are where the wind comes from. */
export function windAspect(windFromDeg: number, facingDeg: number): Aspect {
  const offshoreFrom = (facingDeg + 180) % 360;
  const delta = angleDelta(windFromDeg, offshoreFrom);
  if (delta <= 55) return "offshore";
  if (delta >= 125) return "onshore";
  return "cross";
}

function sizeWord(feet: number): string {
  if (feet < 1.5) return "Small";
  if (feet < 2.5) return "Knee-high";
  if (feet < 3.5) return "Waist-high";
  if (feet < 4.5) return "Chest-high";
  if (feet < 6) return "Head-high";
  if (feet < 9) return "Overhead";
  return "Well overhead";
}

function periodWord(seconds: number): string {
  if (seconds < 9) return "short-period";
  if (seconds < 12) return "mid-period";
  return "long-period";
}

function windPhrase(knots: number, aspect: Aspect | null): string {
  const strength = knots < 8 ? "light" : knots < 16 ? "moderate" : "strong";
  if (aspect === "cross") return `${strength} cross-shore wind`;
  if (aspect === "offshore" || aspect === "onshore") return `${strength} ${aspect} wind`;
  return `${strength} wind`;
}

export function scoreConditions(input: ScoreInput): { score: number; why: string } {
  const height = clamp(interp(input.heightFt, HEIGHT), 0, 10);
  const period = clamp(interp(input.periodS, PERIOD), 0, 10);
  let wind = clamp(interp(input.windKt, WIND), 0, 10);
  let aspect: Aspect | null = null;
  if (
    input.windFromDeg != null &&
    input.facingDeg != null &&
    Number.isFinite(input.windFromDeg) &&
    Number.isFinite(input.facingDeg)
  ) {
    aspect = windAspect(input.windFromDeg, input.facingDeg);
    if (aspect === "offshore") wind = Math.min(10, wind + 0.8);
    else if (aspect === "cross") wind = Math.max(0, wind - 0.6);
    else wind = Math.max(0, wind - 2.4);
  }
  const raw = 0.4 * height + 0.33 * period + 0.27 * wind;
  const score = clamp(Math.round(raw), 1, 10);
  const noun = input.kind === "waves" ? "waves" : "swell";
  const core = `${sizeWord(input.heightFt)} ${periodWord(input.periodS)} ${noun}`;
  const windText = windPhrase(input.windKt, aspect);
  const why =
    input.heightFt >= 3 && input.windKt >= 16 ? `${core}, but ${windText}.` : `${core} and ${windText}.`;
  return { score, why };
}
