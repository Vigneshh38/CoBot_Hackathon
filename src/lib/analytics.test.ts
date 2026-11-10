import { test } from "node:test";
import assert from "node:assert/strict";
import { averageMinutes, formatMinutes, hourlyBuckets } from "./analytics.ts";

const NOW = Date.parse("2026-11-10T12:30:00Z");

test("hourly buckets: 24 hours, oldest first, current hour last", () => {
  const b = hourlyBuckets([
    "2026-11-10T12:05:00Z", "2026-11-10T12:20:00Z", // current hour
    "2026-11-10T11:59:00Z", // previous hour
    "2026-11-09T13:10:00Z", // 23 hours ago -> first bucket
    "2026-11-09T12:10:00Z", // 24 hours ago -> outside
    "2026-11-10T13:10:00Z", // future -> outside
  ], NOW);
  assert.equal(b.length, 24);
  assert.equal(b[23].n, 2);
  assert.equal(b[22].n, 1);
  assert.equal(b[0].n, 1);
  assert.equal(b.reduce((s, x) => s + x.n, 0), 4);
});

test("average minutes ignores bad pairs and handles empty", () => {
  assert.equal(averageMinutes([]), null);
  assert.equal(averageMinutes([
    { from: "2026-11-10T10:00:00Z", to: "2026-11-10T10:04:00Z" },
    { from: "2026-11-10T10:00:00Z", to: "2026-11-10T10:10:00Z" },
    { from: "2026-11-10T10:00:00Z", to: "2026-11-10T09:00:00Z" }, // negative, ignored
  ]), 7);
});

test("format minutes", () => {
  assert.equal(formatMinutes(null), "—");
  assert.equal(formatMinutes(45), "45 min");
  assert.equal(formatMinutes(120), "2 h");
  assert.equal(formatMinutes(125), "2 h 5 min");
});
