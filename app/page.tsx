"use client";

import dynamic from "next/dynamic";

const MapApp = dynamic(() => import("@/components/MapApp"), {
  ssr: false,
  loading: () => <div className="map-loading" />,
});

export default function HomePage() {
  return <MapApp />;
}
