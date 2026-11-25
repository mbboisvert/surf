import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compass, formatMiles } from "../lib/format.ts";
import { nearestBreaks } from "../lib/geo.ts";

describe("geo", () => {
  it("names the compass points", () => {
    assert.equal(compass(0), "N");
    assert.equal(compass(90), "E");
    assert.equal(compass(270), "W");
    assert.equal(compass(359), "N");
  });

  it("returns the five nearest even when the click is inland", () => {
    const spots = [
      { id: "near", lat: 39.1, lon: -97.9 },
      { id: "far", lat: -34, lon: 25 },
      { id: "b", lat: 40, lon: -100 },
      { id: "c", lat: 41, lon: -96 },
      { id: "d", lat: 38, lon: -99 },
      { id: "e", lat: 42, lon: -95 },
    ];
    const nearest = nearestBreaks(spots, 39, -98, 5);
    assert.equal(nearest.length, 5);
    assert.equal(nearest[0]?.spot.id, "near");
    assert.equal(nearest.some((row) => row.spot.id === "far"), false);
    for (let index = 1; index < nearest.length; index++) {
      const previous = nearest[index - 1];
      const current = nearest[index];
      assert.ok(previous && current && current.km >= previous.km);
    }
  });

  it("formats long inland distances in whole miles", () => {
    assert.equal(formatMiles(842.4), "842 mi");
    assert.equal(formatMiles(4.24), "4.2 mi");
  });
});
