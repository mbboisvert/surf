import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreConditions, windAspect } from "../lib/score.ts";

describe("score", () => {
  it("scores a clean long-period swell highly", () => {
    const result = scoreConditions({
      heightFt: 5,
      periodS: 14,
      windKt: 6,
      windFromDeg: 90,
      facingDeg: 270,
    });
    assert.ok(result.score >= 8 && result.score <= 10);
    assert.equal(result.why, "Head-high long-period swell and light offshore wind.");
  });

  it("scores a small, windy, onshore sea poorly", () => {
    const result = scoreConditions({
      heightFt: 1.2,
      periodS: 7,
      windKt: 18,
      windFromDeg: 270,
      facingDeg: 270,
    });
    assert.ok(result.score <= 3);
    assert.equal(result.why, "Small short-period swell and strong onshore wind.");
  });

  it("names strong wind as the reason a solid swell is marked down", () => {
    const result = scoreConditions({
      heightFt: 8,
      periodS: 15,
      windKt: 22,
      windFromDeg: 180,
      facingDeg: 180,
    });
    assert.ok(result.score >= 3 && result.score <= 7);
    assert.equal(result.why, "Overhead long-period swell, but strong onshore wind.");
  });

  it("stays on the 1 to 10 scale", () => {
    for (const heightFt of [0, 1, 3, 6, 12, 20]) {
      for (const periodS of [5, 10, 16]) {
        for (const windKt of [0, 10, 30]) {
          const { score } = scoreConditions({ heightFt, periodS, windKt });
          assert.ok(score >= 1 && score <= 10);
          assert.equal(score, Math.round(score));
        }
      }
    }
  });

  it("reads offshore, cross, and onshore from the facing", () => {
    assert.equal(windAspect(90, 270), "offshore");
    assert.equal(windAspect(270, 270), "onshore");
    assert.equal(windAspect(0, 270), "cross");
  });
});
