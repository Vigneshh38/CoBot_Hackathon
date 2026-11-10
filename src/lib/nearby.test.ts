import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanPhones, familySmsText, formatDistance, nearbyAlertText, offlineSmsText, pickNearby } from "./nearby.ts";

const now = Date.parse("2026-11-10T12:00:00Z");
const fresh = new Date(now - 10 * 60_000).toISOString();
const sos = { lat: 13.0108, lng: 80.2206 }; // Guindy

const sub = (id: number, lat: number | null, lng: number | null, extra: Partial<{ device_id: string; role: string; loc_at: string | null }> = {}) =>
  ({ id, lat, lng, device_id: `dev-${id}`, role: "citizen", loc_at: fresh, ...extra });

test("picks only people within 3 km, closest first", () => {
  const subs = [
    sub(1, 13.0200, 80.2206), // ~1.0 km north
    sub(2, 13.0115, 80.2210), // ~90 m
    sub(3, 13.0850, 80.2101), // Anna Nagar, ~8 km
    sub(4, 13.0360, 80.2206), // ~2.8 km
  ];
  const got = pickNearby(subs, sos, { now });
  assert.deepEqual(got.map((s) => s.id), [2, 1, 4]);
  assert.ok(got[0].km < 0.1 && got[2].km < 3);
});

test("skips sender's device, admins, missing and stale locations", () => {
  const subs = [
    sub(1, 13.0110, 80.2206, { device_id: "me" }),
    sub(2, 13.0110, 80.2206, { role: "admin" }),
    sub(3, null, null),
    sub(4, 13.0110, 80.2206, { loc_at: new Date(now - 30 * 3600_000).toISOString() }),
    sub(5, 13.0110, 80.2206, { loc_at: null }),
    sub(6, 13.0110, 80.2206),
  ];
  assert.deepEqual(pickNearby(subs, sos, { now, excludeDevice: "me" }).map((s) => s.id), [6]);
});

test("radius is configurable", () => {
  const subs = [sub(1, 13.0200, 80.2206)];
  assert.equal(pickNearby(subs, sos, { now, radiusKm: 0.5 }).length, 0);
  assert.equal(pickNearby(subs, sos, { now, radiusKm: 2 }).length, 1);
});

test("distance text and notification copy", () => {
  assert.equal(formatDistance(0.347), "350 m");
  assert.equal(formatDistance(0.001), "10 m");
  assert.equal(formatDistance(1.24), "1.2 km");
  const t = nearbyAlertText(1.24, "Guindy, Chennai");
  assert.match(t.title, /1\.2 km away/);
  assert.match(t.body, /112/);
});

test("family SMS has the name, place and a map link", () => {
  const s = familySmsText("Ravi", "Guindy, Chennai", 13.0108, 80.2206);
  assert.match(s, /SOS from Ravi/);
  assert.match(s, /google\.com\/maps\?q=13\.010800,80\.220600/);
  assert.match(familySmsText("", "Unknown location"), /^SOS from Your family member/);
});

test("cleanPhones keeps max 3 valid distinct numbers", () => {
  assert.deepEqual(cleanPhones(["+91 98400 12345", "98400-12345", "abc", "12", "9000000001", "9000000002", "9000000003"]),
    ["+919840012345", "9840012345", "9000000001"]);
  assert.deepEqual(cleanPhones("nope"), []);
});

test("alert page ends when resolved or after 6 hours", async () => {
  const { sosAlertEnded } = await import("./nearby.ts");
  assert.equal(sosAlertEnded("reported", new Date(now - 3600_000).toISOString(), now), false);
  assert.equal(sosAlertEnded("resolved", new Date(now - 60_000).toISOString(), now), true);
  assert.equal(sosAlertEnded("assigned", new Date(now - 7 * 3600_000).toISOString(), now), true);
});

test("offline SMS is first person, has the map link and never claims the control room knows", () => {
  const s = offlineSmsText("Ravi", 12.8768, 80.0844);
  assert.match(s, /^SOS \(Ravi\): I need help now/);
  assert.match(s, /google\.com\/maps\?q=12\.876800,80\.084400/);
  assert.match(s, /call 112/);
  assert.doesNotMatch(s, /control room has been alerted/);
  assert.match(offlineSmsText("", null, null), /GPS is off/);
});
