import { requestOrigin, safePlanetPath } from "@/lib/map-tiles";

const UPSTREAM = "https://tiles.openfreemap.org/planet";

type Params = { path?: string[] };

export async function GET(request: Request, context: { params: Promise<Params> }) {
  const { path = [] } = await context.params;
  const suffix = safePlanetPath(path);
  if (suffix === null) return new Response("Not found", { status: 404 });

  const upstream = `${UPSTREAM}${suffix ? `/${suffix}` : ""}${new URL(request.url).search}`;
  let response: Response;
  try {
    response = await fetch(upstream);
  } catch {
    return new Response("Map tiles unavailable.", { status: 502 });
  }
  if (!response.ok) return new Response("Map tiles unavailable.", { status: 502 });

  if (!suffix) {
    const json = (await response.json()) as { tiles?: string[] };
    const root = requestOrigin(request);
    if (Array.isArray(json.tiles)) {
      json.tiles = json.tiles.map((tile) => tile.replace(`${UPSTREAM}/`, `${root}/api/map/planet/`));
    }
    return Response.json(json, { headers: { "Cache-Control": "public, max-age=300" } });
  }

  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/vnd.mapbox-vector-tile",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
