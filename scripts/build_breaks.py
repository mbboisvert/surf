#!/usr/bin/env python3
"""Build public/breaks.json and data/noaa-stations.json.

Breaks come from OpenStreetMap (sport=surfing, plus named ocean beaches where
the surf list is thin) and a short curated list of well-known spots that adds
an ocean-facing direction for the wind score. Coastline and country shapes are
Natural Earth, public domain.
"""

from __future__ import annotations

import json
import math
import os
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = "/tmp/surfing-raw"
UA = "Surfing/1.0 (public forecast; https://github.com/mbboisvert/surfing)"
GENERIC = {
    "beach",
    "the beach",
    "surf",
    "surfing",
    "surf spot",
    "surfspot",
    "spot",
    "playa",
    "plage",
    "praia",
    "strand",
    "spiaggia",
    "unnamed",
    "no name",
    "null",
    "test",
    "beach park",
}
BLOCKED_CAM_HOSTS = (
    "surfline",
    "magicseaweed",
    "facebook.",
    "instagram.",
    "youtube.",
    "youtu.be",
    "tiktok.",
)
COMPASS = {
    "n": 0,
    "nne": 22,
    "ne": 45,
    "ene": 67,
    "e": 90,
    "ese": 112,
    "se": 135,
    "sse": 157,
    "s": 180,
    "ssw": 202,
    "sw": 225,
    "wsw": 247,
    "w": 270,
    "wnw": 292,
    "nw": 315,
    "nnw": 337,
    "north": 0,
    "east": 90,
    "south": 180,
    "west": 270,
}

# name, lat, lon, facing (toward the ocean), place
CURATED = [
    ("Mavericks", 37.494, -122.501, 285, "California, United States"),
    ("Steamer Lane", 36.951, -122.026, 200, "California, United States"),
    ("Pleasure Point", 36.962, -121.972, 170, "California, United States"),
    ("Ocean Beach", 37.759, -122.510, 270, "California, United States"),
    ("Linda Mar", 37.596, -122.506, 260, "California, United States"),
    ("Waddell Creek", 37.096, -122.279, 270, "California, United States"),
    ("Trestles", 33.384, -117.589, 230, "California, United States"),
    ("Black's Beach", 32.889, -117.253, 270, "California, United States"),
    ("Swami's", 33.034, -117.292, 250, "California, United States"),
    ("Windansea", 32.830, -117.281, 260, "California, United States"),
    ("Malibu", 34.025, -118.678, 200, "California, United States"),
    ("Rincon", 34.372, -119.477, 190, "California, United States"),
    ("Huntington Pier", 33.655, -118.003, 230, "California, United States"),
    ("Salt Creek", 33.479, -117.725, 240, "California, United States"),
    ("Pipeline", 21.665, -158.053, 315, "Hawaii, United States"),
    ("Waimea Bay", 21.642, -158.066, 320, "Hawaii, United States"),
    ("Sunset Beach", 21.679, -158.041, 330, "Hawaii, United States"),
    ("Honolua Bay", 21.014, -156.639, 330, "Hawaii, United States"),
    ("Peahi", 20.941, -156.302, 10, "Hawaii, United States"),
    ("Short Sands", 45.759, -123.966, 270, "Oregon, United States"),
    ("Pacific City", 45.202, -123.968, 270, "Oregon, United States"),
    ("Westport", 46.890, -124.131, 270, "Washington, United States"),
    ("La Push", 47.908, -124.636, 280, "Washington, United States"),
    ("Cox Bay", 49.103, -125.887, 270, "British Columbia, Canada"),
    ("Sebastian Inlet", 27.860, -80.447, 70, "Florida, United States"),
    ("New Smyrna", 29.026, -80.904, 80, "Florida, United States"),
    ("Cape Hatteras", 35.253, -75.520, 90, "North Carolina, United States"),
    ("Montauk", 41.074, -71.857, 180, "New York, United States"),
    ("Narragansett", 41.432, -71.456, 160, "Rhode Island, United States"),
    ("Folly Beach", 32.655, -79.939, 130, "South Carolina, United States"),
    ("Wrightsville Beach", 34.208, -77.796, 120, "North Carolina, United States"),
    ("Rockaway Beach", 40.583, -73.816, 160, "New York, United States"),
    ("Manasquan", 40.113, -74.042, 110, "New Jersey, United States"),
    ("Puerto Escondido", 15.860, -97.068, 200, "Oaxaca, Mexico"),
    ("Sayulita", 20.869, -105.440, 250, "Nayarit, Mexico"),
    ("Santa Teresa", 9.643, -85.168, 260, "Costa Rica"),
    ("Pavones", 8.390, -83.143, 200, "Costa Rica"),
    ("Popoyo", 11.445, -86.118, 240, "Nicaragua"),
    ("Punta Roca", 13.492, -89.366, 200, "El Salvador"),
    ("Tamarindo", 10.299, -85.842, 260, "Costa Rica"),
    ("Chicama", -7.705, -79.443, 250, "Peru"),
    ("Lobitos", -4.452, -81.283, 270, "Peru"),
    ("Punta Hermosa", -12.333, -76.824, 230, "Peru"),
    ("Pichilemu", -34.387, -72.017, 260, "Chile"),
    ("Punta de Lobos", -34.426, -72.048, 250, "Chile"),
    ("Joaquina", -27.629, -48.447, 90, "Brazil"),
    ("Saquarema", -22.932, -42.497, 120, "Brazil"),
    ("Itacoatiara", -22.975, -43.030, 160, "Brazil"),
    ("Montañita", -1.826, -80.755, 270, "Ecuador"),
    ("Nazaré", 39.603, -9.071, 310, "Portugal"),
    ("Supertubos", 39.343, -9.364, 290, "Portugal"),
    ("Coxos", 39.066, -9.415, 300, "Portugal"),
    ("Ribeira d'Ilhas", 39.021, -9.422, 290, "Portugal"),
    ("Carcavelos", 38.678, -9.337, 280, "Portugal"),
    ("Mundaka", 43.407, -2.698, 340, "Spain"),
    ("Zarautz", 43.284, -2.163, 330, "Spain"),
    ("Hossegor", 43.668, -1.441, 280, "France"),
    ("Lacanau", 44.987, -1.204, 280, "France"),
    ("Biarritz", 43.483, -1.569, 290, "France"),
    ("Guéthary", 43.424, -1.610, 300, "France"),
    ("Fistral", 50.417, -5.099, 280, "England, United Kingdom"),
    ("Croyde", 51.131, -4.239, 270, "England, United Kingdom"),
    ("Thurso East", 58.597, -3.521, 330, "Scotland, United Kingdom"),
    ("Mullaghmore", 54.466, -8.447, 300, "Ireland"),
    ("Lahinch", 52.933, -9.351, 270, "Ireland"),
    ("Bundoran", 54.479, -8.281, 280, "Ireland"),
    ("Anchor Point", 30.545, -9.710, 300, "Morocco"),
    ("Imsouane", 30.841, -9.821, 270, "Morocco"),
    ("Jeffreys Bay", -34.021, 24.931, 230, "South Africa"),
    ("Muizenberg", -34.109, 18.470, 100, "South Africa"),
    ("Dungeons", -34.201, 18.460, 230, "South Africa"),
    ("Elands Bay", -32.317, 18.320, 270, "South Africa"),
    ("Tofo", -23.857, 35.548, 90, "Mozambique"),
    ("Bells Beach", -38.369, 144.282, 190, "Victoria, Australia"),
    ("Snapper Rocks", -28.163, 153.551, 80, "Queensland, Australia"),
    ("Burleigh Heads", -28.094, 153.459, 80, "Queensland, Australia"),
    ("Noosa Heads", -26.387, 153.091, 40, "Queensland, Australia"),
    ("Byron Bay", -28.640, 153.620, 90, "New South Wales, Australia"),
    ("Margaret River", -33.975, 114.988, 250, "Western Australia, Australia"),
    ("Manu Bay", -37.819, 174.822, 300, "New Zealand"),
    ("Piha", -36.953, 174.469, 260, "New Zealand"),
    ("St Clair", -45.910, 170.490, 160, "New Zealand"),
    ("Uluwatu", -8.829, 115.085, 230, "Bali, Indonesia"),
    ("Padang Padang", -8.811, 115.102, 240, "Bali, Indonesia"),
    ("Bingin", -8.805, 115.108, 230, "Bali, Indonesia"),
    ("Desert Point", -8.766, 116.086, 200, "Lombok, Indonesia"),
    ("Lakey Peak", -8.802, 118.383, 160, "Sumbawa, Indonesia"),
    ("G-Land", -8.716, 114.355, 210, "Java, Indonesia"),
    ("Lagundri Bay", 0.570, 97.708, 200, "Nias, Indonesia"),
    ("Cloud 9", 9.808, 126.165, 50, "Siargao, Philippines"),
    ("Cloudbreak", -17.866, 177.204, 220, "Fiji"),
    ("Teahupo'o", -17.867, -149.259, 200, "Tahiti, French Polynesia"),
    ("Arugam Bay", 6.841, 81.836, 140, "Sri Lanka"),
]


def request(url: str, data: bytes | None = None, timeout: int = 240) -> bytes:
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read()


def cached_json(name: str, producer) -> dict:
    os.makedirs(RAW, exist_ok=True)
    path = os.path.join(RAW, name)
    if os.path.exists(path) and os.path.getsize(path) > 100:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    data = producer()
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle)
    return data


def overpass(query: str) -> dict:
    servers = [
        "https://overpass.openstreetmap.fr/api/interpreter",
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
    ]
    last = None
    body = urllib.parse.urlencode({"data": query}).encode()
    for attempt in range(6):
        url = servers[attempt % len(servers)]
        try:
            print(f"overpass {url} attempt {attempt + 1}", flush=True)
            raw = request(url, body, timeout=150)
            if raw[:1] not in (b"{", b"["):
                raise RuntimeError(raw[:180].decode("utf-8", "replace"))
            payload = json.loads(raw.decode("utf-8"))
            if "elements" not in payload:
                raise RuntimeError(str(payload)[:400])
            print(f"  elements {len(payload['elements'])}", flush=True)
            return payload
        except Exception as error:  # noqa: BLE001 - retry another mirror
            last = error
            print(f"  failed: {error}", flush=True)
            time.sleep(6 * (attempt + 1))
    raise RuntimeError(f"overpass failed: {last}")


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * radius * math.asin(min(1, math.sqrt(a)))


def parse_direction(value) -> int | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    if text in COMPASS:
        return COMPASS[text]
    try:
        degrees = float(text)
    except ValueError:
        return None
    if 0 <= degrees <= 360:
        return int(round(degrees)) % 360
    return None


def cam_url(tags: dict) -> str | None:
    raw = tags.get("contact:webcam") or tags.get("webcam") or ""
    if not str(raw).startswith("https://"):
        return None
    host = urllib.parse.urlparse(raw).hostname or ""
    if any(part in host for part in BLOCKED_CAM_HOSTS):
        return None
    return raw


def generic(name: str) -> bool:
    return name.strip().lower() in GENERIC


def business(name: str) -> bool:
    text = name.lower()
    return any(word in text for word in ("school", "shop", "rental", "academy", "surfshop"))


def point_of(element: dict) -> tuple[float, float] | None:
    if "lat" in element and "lon" in element:
        return float(element["lat"]), float(element["lon"])
    center = element.get("center") or {}
    if "lat" in center and "lon" in center:
        return float(center["lat"]), float(center["lon"])
    return None


def slug(name: str, lat: float, lon: float) -> str:
    import re
    import unicodedata

    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-") or "break"
    return f"{text}-{lat:.3f}-{lon:.3f}"


def pip(lon: float, lat: float, ring: list) -> bool:
    inside = False
    count = len(ring)
    if count < 3:
        return False
    j = count - 1
    for i in range(count):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat):
            xint = (xj - xi) * (lat - yi) / ((yj - yi) or 1e-15) + xi
            if lon < xint:
                inside = not inside
        j = i
    return inside


def iter_polygons(geometry: dict):
    kind = geometry.get("type")
    coords = geometry.get("coordinates") or []
    if kind == "Polygon":
        yield coords
    elif kind == "MultiPolygon":
        yield from coords


def in_geometry(lon: float, lat: float, geometry: dict) -> bool:
    for poly in iter_polygons(geometry):
        if not poly or not pip(lon, lat, poly[0]):
            continue
        if any(pip(lon, lat, hole) for hole in poly[1:]):
            continue
        return True
    return False


def load_countries(path: str):
    data = json.load(open(path, encoding="utf-8"))
    countries = []
    for feature in data["features"]:
        props = feature.get("properties") or {}
        name = props.get("ADMIN") or props.get("NAME") or ""
        if name == "United States of America":
            name = "United States"
        geometry = feature.get("geometry") or {}
        xs, ys = [], []
        for poly in iter_polygons(geometry):
            for ring in poly:
                for x, y in ring:
                    xs.append(x)
                    ys.append(y)
        if not xs:
            continue
        countries.append(
            {
                "name": name,
                "geometry": geometry,
                "bbox": (min(xs), min(ys), max(xs), max(ys)),
                "sample": [(x, y) for poly in iter_polygons(geometry) for ring in poly for x, y in ring[::40]],
            }
        )
    return countries


def country_at(countries, lon: float, lat: float) -> str:
    for country in countries:
        minx, miny, maxx, maxy = country["bbox"]
        if lon < minx - 0.4 or lon > maxx + 0.4 or lat < miny - 0.4 or lat > maxy + 0.4:
            continue
        if in_geometry(lon, lat, country["geometry"]):
            return country["name"]
    best_name, best_d = "", 1e9
    for country in countries:
        minx, miny, maxx, maxy = country["bbox"]
        if lon < minx - 5 or lon > maxx + 5 or lat < miny - 5 or lat > maxy + 5:
            continue
        for x, y in country["sample"]:
            d = (x - lon) ** 2 + (y - lat) ** 2
            if d < best_d:
                best_d = d
                best_name = country["name"]
    return best_name if best_d <= 4 else ""


def coastal_cells(path: str) -> set[tuple[int, int]]:
    data = json.load(open(path, encoding="utf-8"))
    cells: set[tuple[int, int]] = set()

    def mark(lon: float, lat: float) -> None:
        i = math.floor(lat / 0.25)
        j = math.floor(lon / 0.25)
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                cells.add((i + di, j + dj))

    for feature in data["features"]:
        geometry = feature.get("geometry") or {}
        kind = geometry.get("type")
        coords = geometry.get("coordinates") or []
        lines = coords if kind == "MultiLineString" else [coords]
        for line in lines:
            for point in line:
                if len(point) < 2:
                    continue
                mark(float(point[0]), float(point[1]))
    return cells


def is_coastal(cells: set[tuple[int, int]], lat: float, lon: float) -> bool:
    return (math.floor(lat / 0.25), math.floor(lon / 0.25)) in cells


def place_from(tags: dict, country: str) -> str:
    city = (tags.get("addr:city") or tags.get("addr:suburb") or "").strip()
    state = (tags.get("addr:state") or tags.get("is_in:state") or "").strip()
    raw_country = (tags.get("addr:country") or tags.get("is_in:country") or "").strip()
    if len(raw_country) <= 3:
        raw_country = ""
    parts = []
    for part in (city, state, raw_country or country):
        if part and part not in parts:
            parts.append(part)
    return ", ".join(parts)


def spots_from(elements: list, kind: str, countries, cells) -> list[dict]:
    spots = []
    for element in elements:
        tags = element.get("tags") or {}
        name = " ".join(str(tags.get("name:en") or tags.get("name") or "").split())
        if not name or generic(name) or business(name):
            continue
        point = point_of(element)
        if not point:
            continue
        lat, lon = point
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        if kind == "beach" and not is_coastal(cells, lat, lon):
            continue
        spots.append(
            {
                "name": name,
                "lat": round(lat, 5),
                "lon": round(lon, 5),
                "place": place_from(tags, country_at(countries, lon, lat)),
                "facing": parse_direction(tags.get("direction")),
                "cam": cam_url(tags),
                "kind": kind,
            }
        )
    return spots


def dedupe(spots: list[dict], kilometers: float) -> list[dict]:
    def rank(spot: dict):
        return (generic(spot["name"]), not bool(spot.get("cam")), len(spot["name"]))

    ordered = sorted(spots, key=rank)
    kept: list[dict] = []
    for spot in ordered:
        if any(haversine_km(spot["lat"], spot["lon"], other["lat"], other["lon"]) < kilometers for other in kept):
            continue
        kept.append(spot)
    return kept


def with_ids(spots: list[dict]) -> list[dict]:
    seen = set()
    output = []
    for spot in sorted(spots, key=lambda item: (item["lat"], item["lon"], item["name"])):
        base = slug(spot["name"], spot["lat"], spot["lon"])
        ident = base
        n = 2
        while ident in seen:
            ident = f"{base}-{n}"
            n += 1
        seen.add(ident)
        output.append(
            {
                "id": ident,
                "name": spot["name"],
                "lat": spot["lat"],
                "lon": spot["lon"],
                "place": spot["place"],
                "facing": spot["facing"],
                "cam": spot["cam"],
            }
        )
    return output


def plain_name(name: str) -> str:
    import re
    import unicodedata

    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def apply_curated(spots: list[dict], cells) -> list[dict]:
    for name, lat, lon, facing, place in CURATED:
        if not is_coastal(cells, lat, lon):
            print(f"skip curated off the coastal grid: {name} {lat} {lon}", flush=True)
            continue
        best_i, best_d = None, 1e9
        for index, spot in enumerate(spots):
            distance = haversine_km(lat, lon, spot["lat"], spot["lon"])
            if distance < best_d:
                best_i, best_d = index, distance
        wanted = plain_name(name)
        if best_i is not None and best_d <= 1.2 and wanted and wanted in plain_name(spots[best_i]["name"]):
            spots[best_i]["facing"] = facing
            if not spots[best_i]["place"]:
                spots[best_i]["place"] = place
            continue
        spots.append(
            {
                "name": name,
                "lat": lat,
                "lon": lon,
                "place": place,
                "facing": facing,
                "cam": None,
                "kind": "curated",
            }
        )
    return spots


def build_beaches(beaches: list[dict], surf: list[dict], cap: int) -> list[dict]:
    buckets: dict[tuple[int, int], list[dict]] = {}
    for beach in beaches:
        if any(haversine_km(beach["lat"], beach["lon"], spot["lat"], spot["lon"]) < 1.5 for spot in surf):
            continue
        key = (round(beach["lat"]), round(beach["lon"]))
        buckets.setdefault(key, []).append(beach)
    chosen = []
    for items in buckets.values():
        items.sort(key=lambda spot: spot["name"])
        chosen.extend(items[:cap])
    return dedupe(surf + chosen, 0.6)


def write_stations() -> None:
    def produce():
        print("fetching NOAA stations")
        url = "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions"
        return json.loads(request(url, timeout=120).decode("utf-8"))

    payload = cached_json("noaa.json", produce)
    stations = []
    for station in payload.get("stations") or []:
        if station.get("type") != "R":
            continue
        try:
            lat = float(station["lat"])
            lng = float(station["lng"])
        except (TypeError, ValueError, KeyError):
            continue
        if abs(lat) < 0.01 and abs(lng) < 0.01:
            continue
        name = " ".join(str(station.get("name") or "").split())
        if not name or not station.get("id"):
            continue
        stations.append({"id": str(station["id"]), "name": name, "lat": round(lat, 5), "lng": round(lng, 5)})
    path = os.path.join(ROOT, "data", "noaa-stations.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(stations, handle, separators=(",", ":"))
        handle.write("\n")
    print(f"stations {len(stations)}")
    near = min(stations, key=lambda s: haversine_km(36.95, -122.02, s["lat"], s["lng"]))
    print("nearest to Steamer Lane area", near["name"], f"{haversine_km(36.95, -122.02, near['lat'], near['lng']):.1f} km")


def main() -> None:
    write_stations()
    countries = load_countries(os.path.join(RAW, "countries.geojson"))
    cells = coastal_cells(os.path.join(RAW, "coastline.geojson"))
    print(f"countries {len(countries)} coastal cells {len(cells)}")

    surf_query = """
    [out:json][timeout:180];
    (
      node["sport"="surfing"]["name"];
      way["sport"="surfing"]["name"];
    );
    out center;
    """
    surf_raw = cached_json("surf.json", lambda: overpass(surf_query))
    beach_elements = []
    for south, north in ((-60, -30), (-30, 0), (0, 30), (30, 72)):
        band_query = f"""
        [out:json][timeout:120];
        node["natural"="beach"]["name"]({south},-180,{north},180);
        out body;
        """
        band = cached_json(f"beaches-{south}.json", lambda q=band_query: overpass(q))
        beach_elements.extend(band.get("elements") or [])
        time.sleep(3)
    surf = spots_from(surf_raw.get("elements") or [], "surf", countries, cells)
    beaches = spots_from(beach_elements, "beach", countries, cells)
    surf = dedupe(surf, 0.5)
    print(f"named surf spots {len(surf)} coastal beaches {len(beaches)}")

    chosen = surf
    for cap in (6, 5, 4, 3, 2, 1):
        chosen = build_beaches(beaches, surf, cap)
        print(f"cap {cap} -> {len(chosen)}")
        if len(chosen) <= 5200:
            break
    if len(chosen) < 2500:
        chosen = build_beaches(beaches, surf, 8)
        print(f"raised cap -> {len(chosen)}")
    chosen = apply_curated(chosen, cells)
    output = with_ids(chosen)
    cams = sum(1 for spot in output if spot["cam"])
    facing = sum(1 for spot in output if spot["facing"] is not None)
    payload = {
        "attribution": "Break locations include © OpenStreetMap contributors, available under the Open Database License.",
        "breaks": output,
    }
    path = os.path.join(ROOT, "public", "breaks.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")
    print(f"wrote {len(output)} breaks, {facing} with facing, {cams} cameras -> {path}")


if __name__ == "__main__":
    main()
