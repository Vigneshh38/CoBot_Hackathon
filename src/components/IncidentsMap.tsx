"use client";

import { useEffect, useRef } from "react";
import { LngLatBounds, Map as MapLibre, Marker, NavigationControl, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const KEY = process.env.NEXT_PUBLIC_CARTO_KEY;
const STYLE = KEY
  ? `https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json?key=${encodeURIComponent(KEY)}`
  : "https://tiles.openfreemap.org/styles/liberty";
const COLOR: Record<string, string> = { critical: "#b3261e", high: "#b4581c", medium: "#8a7214", low: "#4f7a5a" };

export interface MapPoint { id: number; lat: number; lng: number; title: string; severity: string }

/** Live map of incidents with GPS. Click a pin to open the incident. Defaults to Chennai when empty. */
export function IncidentsMap({ points, height = 360 }: { points: MapPoint[]; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const markers = useRef<Marker[]>([]);
  const fitted = useRef(false);

  useEffect(() => {
    if (!box.current) return;
    map.current = new MapLibre({ container: box.current, style: STYLE, center: [80.24, 13.05], zoom: 10.5, attributionControl: { compact: true } });
    map.current.addControl(new NavigationControl({ showCompass: false }), "top-left");
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  // Redraw pins when data refreshes; only auto-fit the first time so the admin's zoom is kept.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = points.map((p) => {
      const el = document.createElement("a");
      el.href = `/admin/incidents/${p.id}`;
      el.className = `map-pin ${p.severity === "critical" ? "pulse" : ""}`;
      el.style.background = COLOR[p.severity] ?? COLOR.low;
      el.setAttribute("aria-label", p.title);
      const popup = new Popup({ offset: 12, closeButton: false }).setText(p.title);
      el.addEventListener("mouseenter", () => popup.setLngLat([p.lng, p.lat]).addTo(m));
      el.addEventListener("mouseleave", () => popup.remove());
      return new Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(m);
    });
    if (!fitted.current && points.length) {
      const b = new LngLatBounds();
      points.forEach((p) => b.extend([p.lng, p.lat]));
      m.fitBounds(b, { padding: 48, maxZoom: 14, duration: 0 });
      fitted.current = true;
    }
  }, [points]);

  return <div ref={box} style={{ height, borderRadius: "0 0 14px 14px", overflow: "hidden", borderTop: "1px solid var(--line)" }} />;
}
