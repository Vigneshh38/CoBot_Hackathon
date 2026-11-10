/**
 * Live vehicle tracking (pure, unit-tested). Positions come from the vehicle itself — the crew's phone
 * on /track/<token> or an in-vehicle GPS unit posting to /api/track — never from a simulated speed.
 */
import { z } from "zod";
import { distanceKm } from "./dispatch.ts";

/** One GPS fix as sent by a vehicle. `at` is the device time (ms or ISO); the server time is used if missing or off. */
export const fixSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().min(0).max(100000).optional(), // metres
  speed: z.coerce.number().min(0).max(100).optional(),       // m/s (100 m/s = 360 km/h, anything above is junk)
  heading: z.coerce.number().min(0).max(360).optional(),     // degrees from north
  at: z.union([z.number(), z.string()]).optional(),
});
export type Fix = z.infer<typeof fixSchema>;

export const LIVE_MS = 60_000;          // a fix newer than this = live
export const STALE_MS = 10 * 60_000;    // older than this = offline
export const MIN_INTERVAL_MS = 2_000;   // ignore fixes sent faster than this (battery/abuse guard)
export const MAX_ACCURACY_M = 500;      // a fix less accurate than this is ignored
export const ARRIVED_M = 100;           // within this distance of the incident = on scene

export type LiveState = "live" | "stale" | "offline";

export function liveState(liveAt: string | null | undefined, now = Date.now()): LiveState {
  if (!liveAt) return "offline";
  const age = now - new Date(liveAt).getTime();
  if (age <= LIVE_MS) return "live";
  if (age <= STALE_MS) return "stale";
  return "offline";
}

/** Server-side timestamp for a fix: device time if it is sane (not in the future, under 5 min old), else now. */
export function fixTime(at: Fix["at"], now = Date.now()): number {
  const t = typeof at === "number" ? at : at ? Date.parse(at) : NaN;
  return Number.isFinite(t) && t <= now + 5_000 && now - t <= 5 * 60_000 ? Math.min(t, now) : now;
}

/** Whether a new fix should be stored, given the last stored fix time. */
export function acceptFix(fix: Fix, lastAt: string | null | undefined, now = Date.now()): { ok: true } | { ok: false; reason: string } {
  if (fix.accuracy != null && fix.accuracy > MAX_ACCURACY_M) return { ok: false, reason: "Too inaccurate" };
  if (lastAt && now - new Date(lastAt).getTime() < MIN_INTERVAL_MS) return { ok: false, reason: "Too frequent" };
  return { ok: true };
}

export function hasArrived(pos: { lat: number; lng: number }, target: { lat: number; lng: number }, radiusM = ARRIVED_M): boolean {
  return distanceKm(pos, target) * 1000 <= radiusM;
}

/** "just now", "40 s ago", "3 min ago", "2 h ago". */
export function agoText(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}

/** Re-route from the vehicle only after it has moved this far since the last route (keeps OSRM calls low). */
export const REROUTE_M = 150;
export function needsReroute(lastFrom: { lat: number; lng: number } | null, pos: { lat: number; lng: number }): boolean {
  return !lastFrom || distanceKm(lastFrom, pos) * 1000 >= REROUTE_M;
}
