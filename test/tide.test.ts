import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tideFeet } from "../lib/tide-model.ts";

function samples(lat: number, lon: number, hours: number): number[] {
  const start = Date.UTC(2026, 5, 1);
  return Array.from({ length: hours }, (_, hour) => tideFeet(lat, lon, new Date(start + hour * 3_600_000)));
}

function range(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

describe("tide model", () => {
  it("moves on a semidiurnal cycle in the open ocean", () => {
    const heights = samples(0, -30, 50);
    assert.ok(heights.every((height) => Number.isFinite(height)));
    const peaks: number[] = [];
    for (let index = 1; index < heights.length - 1; index++) {
      const height = heights[index];
      const before = heights[index - 1];
      const after = heights[index + 1];
      if (height != null && before != null && after != null && height > before && height > after) peaks.push(index);
    }
    const gaps = peaks.slice(1).map((peak, index) => peak - (peaks[index] ?? peak));
    assert.ok(gaps.length >= 2);
    assert.ok(gaps.every((gap) => gap >= 11 && gap <= 14));
  });

  it("keeps regional ranges in a plausible band", () => {
    const med = range(samples(43.7, 7.3, 24 * 15));
    const portugal = range(samples(39.6, -9.07, 24 * 15));
    const uk = range(samples(51.1, -4.2, 24 * 15));
    assert.ok(med < 4, `mediterranean range ${med}`);
    assert.ok(portugal > 4 && portugal < 18, `portugal range ${portugal}`);
    assert.ok(uk > 8 && uk < 40, `uk range ${uk}`);
  });
});
