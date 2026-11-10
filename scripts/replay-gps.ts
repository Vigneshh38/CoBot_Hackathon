/**
 * GPS replay for testing without a real vehicle. It acts like the crew's phone: it takes the team's tracking
 * token, drives a real road route (OSRM) from the vehicle's last position to its assigned incident, and POSTs a
 * fix every few seconds to /api/track — the same endpoint a real phone or GPS unit uses. The app itself never
 * simulates movement.
 *
 *   node --import ./scripts/stub-server-only.mjs scripts/replay-gps.ts "Fire Unit F-02" [--speed 40] [--every 3] [--url http://localhost:3000]
 */
import { getIncident, listTeams } from "../src/lib/incidents.ts";
import { pointAlong, type LngLat } from "../src/lib/route.ts";
import { distanceKm } from "../src/lib/dispatch.ts";

const args = process.argv.slice(2);
const opt = (name: string, def: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const who = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const base = opt("url", "http://localhost:3000");
const everyS = Number(opt("every", "3"));
const speedKmh = Number(opt("speed", "35")); // replayed driving speed (a real device reports its own)

const team = listTeams().find((t) => String(t.id) === who || t.name.toLowerCase() === (who ?? "").toLowerCase());
if (!team) { console.error(`Team not found: ${who}. Teams: ${listTeams().map((t) => t.name).join(", ")}`); process.exit(1); }
const job = team.busyWith != null ? getIncident(team.busyWith) : undefined;
if (!job || job.lat == null || job.lng == null) { console.error(`${team.name} has no assigned incident with GPS. Assign one first.`); process.exit(1); }

const from: LngLat = team.live_lat != null && team.live_lng != null ? [team.live_lng, team.live_lat] : [team.lng, team.lat];
const to: LngLat = [job.lng, job.lat];
let coords: LngLat[] = [from, to];
try {
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.join(",")};${to.join(",")}?overview=full&geometries=geojson`,
    { headers: { "User-Agent": "ResQureEmergencyPlatform/0.1 (hackathon prototype)" }, signal: AbortSignal.timeout(8000) });
  const d = await r.json() as { routes?: { geometry: { coordinates: LngLat[] } }[] };
  if (d.routes?.[0]?.geometry.coordinates.length) coords = d.routes[0].geometry.coordinates;
} catch { console.warn("Road route unavailable, replaying a straight line."); }

let km = 0;
for (let i = 1; i < coords.length; i++) km += distanceKm({ lng: coords[i - 1][0], lat: coords[i - 1][1] }, { lng: coords[i][0], lat: coords[i][1] });
const steps = Math.max(1, Math.ceil((km / speedKmh) * 3600 / everyS));
console.log(`${team.name} → #${job.id} ${job.title}: ${km.toFixed(1)} km, ${steps} fixes every ${everyS}s at ${speedKmh} km/h`);

for (let s = 1; s <= steps; s++) {
  const [lng, lat] = pointAlong(coords, s / steps);
  const res = await fetch(`${base}/api/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${team.track_token}` },
    body: JSON.stringify({ lat, lng, accuracy: 8, speed: s === steps ? 0 : speedKmh / 3.6, at: Date.now() }),
  });
  const d = await res.json().catch(() => ({}));
  console.log(`fix ${s}/${steps} ${lat.toFixed(5)},${lng.toFixed(5)} -> ${res.status}${d.arrived ? " (on scene)" : ""}${d.reason ? ` (${d.reason})` : ""}`);
  if (res.status === 401) process.exit(1);
  if (s < steps) await new Promise((r) => setTimeout(r, everyS * 1000));
}
