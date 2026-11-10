/**
 * SOS smoke check: runs the real SOS data layer against a throwaway database in a temp folder.
 * Usage: node --import ./scripts/stub-server-only.mjs scripts/check-sos.ts
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "resqure-sos-"));
process.chdir(tmp); // db.ts stores data/app.db under the current folder
const lib = await import("../src/lib/incidents.ts");
const push = await import("../src/lib/push.ts");
const { db } = await import("../src/lib/db.ts");
const { pickNearby } = await import("../src/lib/nearby.ts");

const ok = (cond: boolean, msg: string) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) process.exitCode = 1; };

// SOS incident
const sos = lib.createSosIncident({ deviceId: "device-victim-1", lat: 13.0108, lng: 80.2206, accuracy: 25, location: "Guindy, Chennai",
  contactName: "Ravi", contactPhone: "9000000000", familyPhones: ["9000000001"] });
ok(sos.is_sos === 1 && sos.severity === "critical" && sos.ai_status === "none", "SOS is saved as Critical, no AI job");
ok(sos.title === "SOS at Guindy" && sos.description.includes("±25 m"), `title "${sos.title}" + GPS accuracy in description`);
ok(lib.listQueue()[0].id === sos.id, "SOS is at the top of the priority queue");
ok(lib.lastOpenSos("device-victim-1")?.id === sos.id && lib.lastOpenSos("other-device", "9000000000")?.id === sos.id, "repeat SOS finds the open SOS by device and by phone");
ok(lib.lastOpenSos("other-device", "9111111111") === undefined, "different device + phone starts a new SOS");
const moved = lib.markRealert(sos.id, 13.0120, 80.2210);
ok(moved.lat === 13.0120 && moved.last_alert_at !== null && lib.listQueue().filter((i) => i.is_sos).length === 1, "repeat press updates position + re-alert time, no duplicate incident");
lib.setAlertedNearby(sos.id, 3); lib.setAlertedNearby(sos.id, 1);
ok(lib.getIncident(sos.id)!.alerted_nearby === 3, "alerted count keeps the highest across re-alerts");
const noGps = lib.createSosIncident({ deviceId: "device-victim-2", familyPhones: [] });
ok(noGps.location === "Location unavailable (GPS off)" && noGps.lat === null, "SOS without GPS still saves");

// Admin unseen list + helpers
ok(lib.listUnseenSos().length === 2, "admin sees 2 unseen SOS");
lib.markSeen(sos.id);
ok(lib.listUnseenSos().length === 1, "opening an SOS removes it from the alarm list");
lib.addHelper(sos.id); lib.addHelper(sos.id);
ok(lib.getIncident(sos.id)!.helpers === 2, "two nearby people marked 'I'm going'");

// Push subscriptions + nearby pick from real rows
const key = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };
push.saveSubscription({ endpoint: "https://push.example/a", ...key, deviceId: "near-1", role: "citizen", lat: 13.0150, lng: 80.2206 });
push.saveSubscription({ endpoint: "https://push.example/b", ...key, deviceId: "far-1", role: "citizen", lat: 13.0850, lng: 80.2101 });
push.saveSubscription({ endpoint: "https://push.example/c", ...key, deviceId: "device-victim-1", role: "citizen", lat: 13.0108, lng: 80.2206 });
push.saveSubscription({ endpoint: "https://push.example/d", ...key, deviceId: "admin-1", role: "admin" });
push.saveSubscription({ endpoint: "https://push.example/b", ...key, deviceId: "far-1", role: "citizen" }); // refresh without location
const rows = db.prepare("SELECT * FROM push_subs").all() as never[];
ok(rows.length === 4, "re-subscribing the same browser updates its row (no duplicate)");
const far = db.prepare("SELECT lat FROM push_subs WHERE endpoint = 'https://push.example/b'").get() as { lat: number };
ok(far.lat === 13.0850, "refresh without location keeps the last known location");
const near = pickNearby(rows, { lat: 13.0108, lng: 80.2206 }, { excludeDevice: sos.device_id });
ok(near.length === 1 && (near[0] as { device_id: string }).device_id === "near-1", "only the person ~470 m away is picked (not far, not the sender, not admin)");
ok(push.vapidKeys().publicKey.length > 80 && fs.existsSync(path.join(tmp, "data", "vapid.json")), "VAPID keys generated once into data/vapid.json");

db.close();
process.chdir(os.tmpdir()); // leave the folder before deleting it (Windows)
fs.rmSync(tmp, { recursive: true, force: true });
