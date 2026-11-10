import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptFix, agoText, fixSchema, fixTime, hasArrived, liveState, needsReroute } from "./tracking.ts";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const ago = (s: number) => new Date(NOW - s * 1000).toISOString();

test("fix schema accepts a phone fix and rejects junk", () => {
  assert.equal(fixSchema.safeParse({ lat: 13.05, lng: 80.25, accuracy: 12, speed: 11.2, heading: 90 }).success, true);
  assert.equal(fixSchema.safeParse({ lat: "13.05", lng: "80.25" }).success, true);
  assert.equal(fixSchema.safeParse({ lat: 95, lng: 80 }).success, false);
  assert.equal(fixSchema.safeParse({ lat: 13, lng: 80, speed: 500 }).success, false);
  assert.equal(fixSchema.safeParse({ lng: 80 }).success, false);
});

test("live state by age of last fix", () => {
  assert.equal(liveState(null, NOW), "offline");
  assert.equal(liveState(ago(20), NOW), "live");
  assert.equal(liveState(ago(5 * 60), NOW), "stale");
  assert.equal(liveState(ago(11 * 60), NOW), "offline");
});

test("device time is used only when sane", () => {
  assert.equal(fixTime(NOW - 3000, NOW), NOW - 3000);
  assert.equal(fixTime(new Date(NOW - 3000).toISOString(), NOW), NOW - 3000);
  assert.equal(fixTime(NOW + 60_000, NOW), NOW); // future clock
  assert.equal(fixTime(NOW - 3600_000, NOW), NOW); // very old
  assert.equal(fixTime(undefined, NOW), NOW);
});

test("fixes that are too frequent or too inaccurate are dropped", () => {
  assert.deepEqual(acceptFix({ lat: 13, lng: 80 }, ago(5), NOW), { ok: true });
  assert.equal(acceptFix({ lat: 13, lng: 80 }, ago(1), NOW).ok, false);
  assert.equal(acceptFix({ lat: 13, lng: 80, accuracy: 900 }, null, NOW).ok, false);
});

test("arrival within 100 m", () => {
  assert.equal(hasArrived({ lat: 13.0, lng: 80.0 }, { lat: 13.0005, lng: 80.0 }), true); // ~55 m
  assert.equal(hasArrived({ lat: 13.0, lng: 80.0 }, { lat: 13.002, lng: 80.0 }), false); // ~220 m
});

test("re-route only after moving 150 m", () => {
  assert.equal(needsReroute(null, { lat: 13, lng: 80 }), true);
  assert.equal(needsReroute({ lat: 13, lng: 80 }, { lat: 13.0005, lng: 80 }), false);
  assert.equal(needsReroute({ lat: 13, lng: 80 }, { lat: 13.002, lng: 80 }), true);
});

test("ago text", () => {
  assert.equal(agoText(null, NOW), "never");
  assert.equal(agoText(ago(2), NOW), "just now");
  assert.equal(agoText(ago(40), NOW), "40 s ago");
  assert.equal(agoText(ago(180), NOW), "3 min ago");
});
