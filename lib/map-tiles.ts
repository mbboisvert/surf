const PLANET = "https://tiles.openfreemap.org/planet";

// EasyPrivacy blocks tiles.openfreemap.org/planet. The map worker can only fetch absolute URLs.
export function mapTileRequest(url: string, origin: string): { url: string } | undefined {
  const root = origin.replace(/\/$/, "");
  if (url === PLANET || url.startsWith(`${PLANET}?`)) {
    return { url: `${root}/api/map/planet${url.slice(PLANET.length)}` };
  }
  if (url.startsWith(`${PLANET}/`)) {
    return { url: `${root}/api/map/planet/${url.slice(PLANET.length + 1)}` };
  }
  return undefined;
}

export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
  const proto = (
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "")
  ).replace(/:$/, "");
  return host ? `${proto}://${host}` : url.origin;
}

export function safePlanetPath(parts: string[]): string | null {
  if (parts.some((part) => part === "." || part === ".." || !/^[A-Za-z0-9._-]+$/.test(part))) return null;
  return parts.join("/");
}
