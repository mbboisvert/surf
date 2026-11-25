import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapTileRequest, requestOrigin, safePlanetPath } from "../lib/map-tiles.ts";

describe("map tiles", () => {
  it("sends the blocked planet source through this site", () => {
    const origin = "https://surf-jcte.vercel.app";
    assert.deepEqual(mapTileRequest("https://tiles.openfreemap.org/planet", origin), {
      url: "https://surf-jcte.vercel.app/api/map/planet",
    });
    assert.deepEqual(mapTileRequest("https://tiles.openfreemap.org/planet?foo=1", origin), {
      url: "https://surf-jcte.vercel.app/api/map/planet?foo=1",
    });
    assert.deepEqual(
      mapTileRequest("https://tiles.openfreemap.org/planet/20261122_124456_pt/4/3/5.pbf", origin),
      { url: "https://surf-jcte.vercel.app/api/map/planet/20261122_124456_pt/4/3/5.pbf" },
    );
    assert.equal(mapTileRequest("https://tiles.openfreemap.org/styles/positron", origin), undefined);
  });

  it("keeps the tile origin on the host the browser used", () => {
    const request = new Request("http://127.0.0.1:3000/api/map/planet", { headers: { host: "127.0.0.1:3000" } });
    assert.equal(requestOrigin(request), "http://127.0.0.1:3000");
  });

  it("rejects a planet path that leaves the tile endpoint", () => {
    assert.equal(safePlanetPath(["20261122_124456_pt", "4", "3", "5.pbf"]), "20261122_124456_pt/4/3/5.pbf");
    assert.equal(safePlanetPath(["..", "etc"]), null);
    assert.equal(safePlanetPath(["a/b"]), null);
  });
});
