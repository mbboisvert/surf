export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function nearestBreaks<T extends { lat: number; lon: number }>(
  spots: T[],
  lat: number,
  lon: number,
  count = 5,
): Array<{ spot: T; km: number }> {
  return spots
    .map((spot) => ({ spot, km: haversineKm(lat, lon, spot.lat, spot.lon) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, count);
}
