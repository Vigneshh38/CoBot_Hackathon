"use client";

import { useEffect, useRef } from "react";
import { LngLatBounds, Map as MapLibre, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const KEY = process.env.NEXT_PUBLIC_CARTO_KEY;
// CARTO Voyager with our key; OpenFreeMap (no key) as fallback.
const STYLE = KEY
  ? `https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json?key=${encodeURIComponent(KEY)}`
  : "https://tiles.openfreemap.org/styles/liberty";

const KIND_SVG: Record<string, string> = {
  medical: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M12 8v8M8 12h8"/>',
  fire: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.6.2 1.8 1 2.8 2 3.2C11 9 11 6 12 3z"/>',
  police: '<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
  rescue: '<circle cx="8" cy="9" r="2.5"/><circle cx="16" cy="9" r="2.5"/><path d="M3.5 18c.5-2.5 2.3-4 4.5-4s4 1.5 4.5 4M11.5 18c.5-2.5 2.3-4 4.5-4s4 1.5 4.5 4"/>',
  flood: '<path d="M3 9c2 0 2-1.5 4.5-1.5S9.5 9 12 9s2.5-1.5 4.5-1.5S19 9 21 9M3 15c2 0 2-1.5 4.5-1.5S9.5 15 12 15s2.5-1.5 4.5-1.5S19 15 21 15"/>',
};

export interface NearbyTeam { id: number; name: string; kind: string; lat: number; lng: number; km: number; busy: boolean; recommended: boolean; assigned: boolean }

export function IncidentMap({ lat, lng, color, teams = [] }: { lat: number; lng: number; color: string; teams?: NearbyTeam[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = new MapLibre({ container: ref.current, style: STYLE, center: [lng, lat], zoom: 14, attributionControl: { compact: true } });
    map.addControl(new NavigationControl({ showCompass: false }), "top-left");
    new Marker({ color }).setLngLat([lng, lat]).addTo(map);

    const b = new LngLatBounds().extend([lng, lat]);
    teams.forEach((t) => {
      const el = document.createElement("div");
      el.className = `unit ${t.busy && !t.assigned ? "busy" : ""} ${t.recommended || t.assigned ? "moving" : ""}`;
      el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${KIND_SVG[t.kind] ?? KIND_SVG.rescue}</svg><span>${t.name} · ${t.km.toFixed(1)} km${t.assigned ? " · assigned" : t.recommended ? " · ★" : t.busy ? " · busy" : ""}</span>`;
      el.title = `${t.name} — ${t.km.toFixed(1)} km${t.busy ? " (busy)" : ""}`;
      new Marker({ element: el, anchor: "left", offset: [-12, 0] }).setLngLat([t.lng, t.lat]).addTo(map);
      b.extend([t.lng, t.lat]);
    });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(ref.current);
    map.once("load", () => { map.resize(); if (teams.length) map.fitBounds(b, { padding: { top: 40, bottom: 40, left: 40, right: 190 }, maxZoom: 15, duration: 0 }); });
    return () => { ro.disconnect(); map.remove(); };
  }, [lat, lng, color, teams]);
  return <div ref={ref} style={{ height: 320, borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)" }} />;
}
