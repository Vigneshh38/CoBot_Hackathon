import { distanceKm } from "./dispatch.ts";

export type LngLat = [number, number];
export interface RouteInfo { coords: LngLat[]; durationS: number; distanceM: number; road: boolean }

/** Straight-line fallback when road routing is unavailable (assumes ~30 km/h city driving). */
export function straightRoute(from: LngLat, to: LngLat): RouteInfo {
  const km = distanceKm({ lng: from[0], lat: from[1] }, { lng: to[0], lat: to[1] });
  return { coords: [from, to], durationS: Math.max(60, (km / 30) * 3600), distanceM: km * 1000, road: false };
}

/** Point at fraction t (0..1) along a polyline, measured by distance. */
export function pointAlong(coords: LngLat[], t: number): LngLat {
  if (coords.length === 1 || t <= 0) return coords[0];
  if (t >= 1) return coords[coords.length - 1];
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = distanceKm({ lng: coords[i - 1][0], lat: coords[i - 1][1] }, { lng: coords[i][0], lat: coords[i][1] });
    seg.push(d);
    total += d;
  }
  let target = total * t;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) {
      const f = seg[i] === 0 ? 0 : Math.min(1, target / seg[i]);
      const [a, b] = [coords[i], coords[i + 1]];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    target -= seg[i];
  }
  return coords[coords.length - 1];
}
