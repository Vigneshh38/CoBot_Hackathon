import { test } from "node:test";
import assert from "node:assert/strict";
import { pointAlong, straightRoute, type LngLat } from "./route.ts";

const line: LngLat[] = [[80.0, 13.0], [80.1, 13.0], [80.1, 13.1]];

test("pointAlong: start, end and middle of a two-segment route", () => {
  assert.deepEqual(pointAlong(line, 0), [80.0, 13.0]);
  assert.deepEqual(pointAlong(line, 1), [80.1, 13.1]);
  const mid = pointAlong(line, 0.5);
  assert.ok(Math.abs(mid[0] - 80.1) < 0.01 && Math.abs(mid[1] - 13.0) < 0.01, String(mid));
});

test("straight fallback route has a sensible duration", () => {
  const r = straightRoute([80.27, 13.08], [80.2337, 13.0405]);
  assert.equal(r.road, false);
  assert.ok(r.durationS > 300 && r.durationS < 1500, String(r.durationS));
});
