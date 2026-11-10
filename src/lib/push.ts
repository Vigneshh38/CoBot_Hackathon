import "server-only";
import fs from "node:fs";
import path from "node:path";
import webpush from "web-push";
import { db, DATA_DIR } from "./db.ts";
import { nearbyAlertText, pickNearby, type SubLike } from "./nearby.ts";
import type { Incident } from "./incidents.ts";

/**
 * Browser push (Web Push + VAPID). Keys come from .env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY);
 * without them a key pair is generated once and kept in data/vapid.json so a demo works out of the box.
 */
let vapid: { publicKey: string; privateKey: string } | null = null;

export function vapidKeys() {
  if (vapid) return vapid;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) vapid = { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY };
  else {
    const file = /*turbopackIgnore: true*/ path.join(DATA_DIR, "vapid.json");
    if (fs.existsSync(file)) vapid = JSON.parse(fs.readFileSync(file, "utf8"));
    else {
      vapid = webpush.generateVAPIDKeys();
      fs.writeFileSync(file, JSON.stringify(vapid));
    }
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:alerts@resqure.app", vapid!.publicKey, vapid!.privateKey);
  return vapid!;
}

export interface PushSub extends SubLike { endpoint: string; p256dh: string; auth: string }

/** Save or refresh a subscription (same endpoint = same browser). Location is optional. */
export function saveSubscription(s: { endpoint: string; p256dh: string; auth: string; deviceId: string; role: "citizen" | "admin"; lat?: number; lng?: number }) {
  const hasLoc = s.lat != null && s.lng != null;
  db.prepare(`INSERT INTO push_subs (endpoint, p256dh, auth, device_id, role, lat, lng, loc_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN ? THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') END)
    ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, device_id = excluded.device_id,
      role = excluded.role,
      lat = COALESCE(excluded.lat, push_subs.lat), lng = COALESCE(excluded.lng, push_subs.lng),
      loc_at = COALESCE(excluded.loc_at, push_subs.loc_at)`)
    .run(s.endpoint, s.p256dh, s.auth, s.deviceId, s.role, s.lat ?? null, s.lng ?? null, hasLoc ? 1 : 0);
}

const allSubs = () => db.prepare("SELECT * FROM push_subs").all() as unknown as PushSub[];
export const countSubs = () => db.prepare("SELECT role, COUNT(*) AS n FROM push_subs GROUP BY role").all() as { role: string; n: number }[];

async function send(sub: PushSub, payload: object): Promise<boolean> {
  vapidKeys();
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload),
      { TTL: 30 * 60, urgency: "high", timeout: 8000 });
    return true;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) db.prepare("DELETE FROM push_subs WHERE id = ?").run(sub.id); // browser unsubscribed
    else console.error(`[push] send failed (${code ?? "network"}):`, (e as Error).message);
    return false;
  }
}

/**
 * Alert everyone who has the site's alerts on and was last seen within 3 km, plus every admin device.
 * Never throws: a push failure must not break the SOS.
 */
export async function sendSosPushes(inc: Incident): Promise<{ nearby: number; admins: number }> {
  try {
    const subs = allSubs();
    const url = `/alert/${inc.code}`;
    const nearby = inc.lat != null && inc.lng != null
      ? pickNearby(subs, { lat: inc.lat, lng: inc.lng }, { excludeDevice: inc.device_id })
      : [];
    const admins = subs.filter((s) => s.role === "admin");
    const results = await Promise.all([
      ...nearby.map((s) => send(s, { kind: "sos", ...nearbyAlertText(s.km, inc.location), url, code: inc.code, km: s.km })),
      ...admins.map((s) => send(s, { kind: "admin-sos", title: "SOS received: Critical", body: `${inc.location}. Open the queue now.`, url: `/admin/incidents/${inc.id}`, code: inc.code })),
    ]);
    const okNearby = results.slice(0, nearby.length).filter(Boolean).length;
    return { nearby: okNearby, admins: results.slice(nearby.length).filter(Boolean).length };
  } catch (e) {
    console.error("[push] SOS fan-out failed:", (e as Error).message);
    return { nearby: 0, admins: 0 };
  }
}

/** Demo check: send a test notification to every subscribed device (ignores location). */
export async function sendTestPush(): Promise<{ total: number; ok: number }> {
  const subs = allSubs();
  const res = await Promise.all(subs.map((s) => send(s, { kind: "test", title: "ResQure test alert", body: "Notifications work on this phone.", url: "/" })));
  return { total: subs.length, ok: res.filter(Boolean).length };
}
