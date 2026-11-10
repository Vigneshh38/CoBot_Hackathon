import { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { straightRoute, type LngLat, type RouteInfo } from "@/lib/route";

/**
 * Road route between a team base and an incident, via the public OSRM demo server (free, no key).
 * Admin-only (so it isn't an open proxy), cached, and falls back to a straight line if OSRM is down.
 */
const cache = new Map<string, RouteInfo>();

const parse = (v: string | null): LngLat | null => {
  const p = (v ?? "").split(",").map(Number);
  return p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90 ? [p[0], p[1]] : null;
};

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const from = parse(req.nextUrl.searchParams.get("from"));
  const to = parse(req.nextUrl.searchParams.get("to"));
  if (!from || !to) return Response.json({ error: "Invalid points" }, { status: 400 });

  const key = `${from.map((n) => n.toFixed(5))};${to.map((n) => n.toFixed(5))}`;
  const hit = cache.get(key);
  if (hit) return Response.json(hit);

  let route: RouteInfo;
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.join(",")};${to.join(",")}?overview=full&geometries=geojson`;
    const res = await fetch(url, { headers: { "User-Agent": "ResQureEmergencyPlatform/0.1 (hackathon prototype)" }, signal: AbortSignal.timeout(8000) });
    const data = (await res.json()) as { routes?: { geometry: { coordinates: LngLat[] }; duration: number; distance: number }[] };
    const r = data.routes?.[0];
    if (!res.ok || !r || r.geometry.coordinates.length < 2) throw new Error("no route");
    route = { coords: r.geometry.coordinates, durationS: Math.max(60, r.duration), distanceM: r.distance, road: true };
  } catch {
    route = straightRoute(from, to);
  }
  cache.set(key, route);
  return Response.json(route);
}
