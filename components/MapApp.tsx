"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map } from "maplibre-gl";
import { nearestBreaks } from "@/lib/geo";
import { mapTileRequest } from "@/lib/map-tiles";
import type { BreakSpot, Forecast } from "@/lib/types";
import { Panel } from "./Panel";

type Near = { spot: BreakSpot; miles: number };

export default function MapApp() {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const breaksRef = useRef<BreakSpot[]>([]);
  const pickRef = useRef<(lat: number, lon: number) => void>(() => {});
  const pendingRef = useRef<{ lat: number; lon: number } | null>(null);
  const [breaks, setBreaks] = useState<BreakSpot[]>([]);
  const [ready, setReady] = useState(false);
  const [nearest, setNearest] = useState<Near[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [forecasts, setForecasts] = useState<Record<string, Forecast>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancel = false;
    fetch("/breaks.json")
      .then((response) => {
        if (!response.ok) throw new Error("breaks");
        return response.json();
      })
      .then((data: { breaks?: BreakSpot[] }) => {
        if (cancel) return;
        const list = data.breaks ?? [];
        breaksRef.current = list;
        setBreaks(list);
      })
      .catch(() => {
        if (!cancel) setLoadError(true);
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      bounds: [
        [-124.85, 24.4],
        [-66.89, 49.38],
      ],
      fitBoundsOptions: { padding: { top: 72, bottom: 28, left: 28, right: 28 } },
      attributionControl: false,
      transformRequest: (url) => mapTileRequest(url, window.location.origin),
      dragRotate: false,
      pitchWithRotate: false,
      minZoom: 1.15,
      maxZoom: 13,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.touchZoomRotate.disableRotation();
    map.on("load", () => {
      map.addSource("spots", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "spots",
        type: "circle",
        source: "spots",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "selected"], 1],
            7,
            ["==", ["get", "listed"], 1],
            5.5,
            4,
          ],
          "circle-color": ["case", ["==", ["get", "selected"], 1], "#1f4b46", "#1c1915"],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#f4f1ea",
        },
      });
      map.on("mouseenter", "spots", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "spots", () => {
        map.getCanvas().style.cursor = "crosshair";
      });
      map.on("click", (event) => {
        const hits = map.queryRenderedFeatures(event.point, { layers: ["spots"] });
        const id = hits[0]?.properties?.id;
        pickRef.current(event.lngLat.lat, event.lngLat.lng);
        if (id) setSelectedId(String(id));
      });
      setReady(true);
    });
    map.getCanvas().style.cursor = "crosshair";
    mapRef.current = map;
    const observed = ref.current;
    const observer = new ResizeObserver(() => {
      map.resize();
      map.triggerRepaint();
    });
    observer.observe(observed);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  function choose(lat: number, lon: number) {
    const list = breaksRef.current;
    if (!list.length) {
      pendingRef.current = { lat, lon };
      return;
    }
    pendingRef.current = null;
    const found = nearestBreaks(list, lat, lon, 5).map((row) => ({
      spot: row.spot,
      miles: row.km * 0.621371,
    }));
    setNearest(found);
    setSelectedId(null);
    setForecasts({});
    setErrors({});
  }

  pickRef.current = choose;

  useEffect(() => {
    if (!ready || !breaks.length) return;
    const ll = new URLSearchParams(window.location.search).get("ll");
    if (ll) {
      const [lat, lon] = ll.split(",").map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        pickRef.current(lat, lon);
        return;
      }
    }
    if (pendingRef.current) pickRef.current(pendingRef.current.lat, pendingRef.current.lon);
  }, [ready, breaks]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource("spots") as GeoJSONSource | undefined;
    const listed = new Set(nearest.map((row) => row.spot.id));
    source?.setData({
      type: "FeatureCollection",
      features: breaks
        .filter((spot) => spot.name)
        .map((spot) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [spot.lon, spot.lat] },
          properties: {
            id: spot.id,
            selected: spot.id === selectedId ? 1 : 0,
            listed: listed.has(spot.id) ? 1 : 0,
          },
        })),
    });
  }, [breaks, nearest, selectedId, ready]);

  const forecastKey = nearest.map((row) => row.spot.id).join("|");

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !nearest.length) return;
    map.resize();
    const bounds = new maplibregl.LngLatBounds();
    nearest.forEach((row) => bounds.extend([row.spot.lon, row.spot.lat]));
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.fitBounds(bounds, {
      padding: mobile
        ? { top: 64, bottom: 28, left: 28, right: 28 }
        : { top: 80, bottom: 48, left: 440, right: 48 },
      maxZoom: 9,
      duration: mobile || reduce ? 0 : 700,
    });
  }, [forecastKey, ready, nearest]);

  useEffect(() => {
    if (!nearest.length) return;
    const controller = new AbortController();
    for (const row of nearest) {
      const spot = row.spot;
      fetch(`/api/forecast?lat=${spot.lat}&lon=${spot.lon}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("forecast");
          return (await response.json()) as Forecast;
        })
        .then((data) => {
          setForecasts((prev) => ({ ...prev, [spot.id]: data }));
        })
        .catch((error: { name?: string }) => {
          if (error?.name === "AbortError") return;
          setErrors((prev) => ({ ...prev, [spot.id]: "Forecast unavailable." }));
        });
    }
    return () => controller.abort();
    // nearest is represented by forecastKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecastKey]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setSelectedId(null);
      setNearest([]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function retry(id: string) {
    const row = nearest.find((item) => item.spot.id === id);
    if (!row) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    fetch(`/api/forecast?lat=${row.spot.lat}&lon=${row.spot.lon}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("forecast");
        return (await response.json()) as Forecast;
      })
      .then((data) => setForecasts((prev) => ({ ...prev, [id]: data })))
      .catch(() => setErrors((prev) => ({ ...prev, [id]: "Forecast unavailable." })));
  }

  return (
    <div className="map-shell" data-open={nearest.length ? (selectedId ? "detail" : "list") : "0"}>
      <div ref={ref} className="map" aria-label="Map of the contiguous United States. Click to find the nearest breaks." />
      {nearest.length === 0 ? (
        <p className="hint">{loadError ? "Breaks didn’t load." : <><span className="desk">Click the map</span><span className="phone">Tap the map</span></>}</p>
      ) : (
        <Panel
          nearest={nearest}
          forecasts={forecasts}
          errors={errors}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onBack={() => setSelectedId(null)}
          onClose={() => {
            setSelectedId(null);
            setNearest([]);
          }}
          onRetry={retry}
        />
      )}
    </div>
  );
}
