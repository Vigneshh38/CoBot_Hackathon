import { distanceKm } from "./dispatch.ts";

/** Pure helpers for SOS "help nearby" alerts (no DB, unit-tested in nearby.test.ts). */

export const NEARBY_RADIUS_KM = 3;
/** A saved location older than this is too stale to call someone "nearby". */
export const NEARBY_MAX_AGE_MS = 24 * 3600_000;
export const MAX_FAMILY_CONTACTS = 3;
/** Nearby people stop seeing an SOS's location after this long. */
export const ALERT_LIFETIME_MS = 6 * 3600_000;

/** An SOS alert page closes when the incident is resolved or 6 hours old. */
export const sosAlertEnded = (status: string, createdAt: string, now = Date.now()) =>
  status === "resolved" || now - new Date(createdAt).getTime() > ALERT_LIFETIME_MS;

export interface SubLike {
  id: number;
  device_id: string | null;
  role: string;
  lat: number | null;
  lng: number | null;
  loc_at: string | null;
}

/**
 * Citizens whose last known location is within `radiusKm` of the SOS point, closest first.
 * Skips the sender's own device, admins (they are alerted separately), unknown and stale locations.
 */
export function pickNearby<T extends SubLike>(
  subs: T[],
  point: { lat: number; lng: number },
  opts: { radiusKm?: number; maxAgeMs?: number; now?: number; excludeDevice?: string | null } = {},
): (T & { km: number })[] {
  const { radiusKm = NEARBY_RADIUS_KM, maxAgeMs = NEARBY_MAX_AGE_MS, now = Date.now(), excludeDevice } = opts;
  return subs
    .filter((s) => s.role === "citizen" && s.lat != null && s.lng != null && s.loc_at)
    .filter((s) => !excludeDevice || s.device_id !== excludeDevice)
    .filter((s) => now - new Date(s.loc_at!).getTime() <= maxAgeMs)
    .map((s) => ({ ...s, km: distanceKm(point, { lat: s.lat!, lng: s.lng! }) }))
    .filter((s) => s.km <= radiusKm)
    .sort((a, b) => a.km - b.km);
}

/** "350 m" under 1 km, otherwise "1.2 km". */
export function formatDistance(km: number): string {
  return km < 1 ? `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m` : `${km.toFixed(1)} km`;
}

/** Text of the push notification a nearby person sees. */
export function nearbyAlertText(km: number, location: string): { title: string; body: string } {
  return {
    title: `SOS: someone needs help ${formatDistance(km)} away`,
    body: `${location}. Tap to see where. Only go if it is safe for you. Call 112.`,
  };
}

export const mapsLink = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

/** SMS sent to the person's family contacts. */
export function familySmsText(name: string | null | undefined, location: string, lat?: number | null, lng?: number | null): string {
  const who = name?.trim() || "Your family member";
  const where = lat != null && lng != null ? `${location} ${mapsLink(lat, lng)}` : location;
  return `SOS from ${who} via ResQure: they need help now at ${where}. The control room has been alerted. Call them, or 112.`;
}

/** SMS the person sends from their own phone when there is no internet (so the control room is NOT alerted yet). */
export function offlineSmsText(name: string | null | undefined, lat?: number | null, lng?: number | null): string {
  const who = name?.trim() ? ` (${name.trim()})` : "";
  const where = lat != null && lng != null ? `I am here: ${mapsLink(lat, lng)}` : "My GPS is off, I will tell you where I am.";
  return `SOS${who}: I need help now. ${where} I have no internet, so please call 112 for me. Sent from ResQure.`;
}

/** Keep valid, distinct phone numbers (max 3). Spaces and dashes are removed. */
export function cleanPhones(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const p = raw.replace(/[\s-]/g, "");
    if (/^\+?\d{7,15}$/.test(p) && !out.includes(p)) out.push(p);
    if (out.length === MAX_FAMILY_CONTACTS) break;
  }
  return out;
}
