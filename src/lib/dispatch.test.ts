import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceKm, rankTeams, type TeamLike } from "./dispatch.ts";

const teams: TeamLike[] = [
  { id: 1, kind: "medical", lat: 13.08, lng: 80.27, busyWith: null }, // far-ish
  { id: 2, kind: "medical", lat: 13.041, lng: 80.234, busyWith: null }, // right at the scene
  { id: 3, kind: "fire", lat: 13.04, lng: 80.23, busyWith: null },
  { id: 4, kind: "medical", lat: 13.0405, lng: 80.2337, busyWith: 9 }, // closest but busy
];

test("distance between two Chennai points is sensible", () => {
  const km = distanceKm({ lat: 13.0405, lng: 80.2337 }, { lat: 13.08, lng: 80.27 });
  assert.ok(km > 5 && km < 7, String(km));
});

test("recommends the nearest free team with the right skill", () => {
  const r = rankTeams(teams, { category: "medical", lat: 13.0405, lng: 80.2337 });
  assert.equal(r[0].team.id, 2);
  assert.equal(r[0].recommended, true);
  assert.equal(r.filter((x) => x.recommended).length, 1);
});

test("busy teams go last even if closest", () => {
  const r = rankTeams(teams, { category: "medical", lat: 13.0405, lng: 80.2337 });
  assert.equal(r[r.length - 1].team.id, 4);
});

test("fire incidents prefer fire teams", () => {
  const r = rankTeams(teams, { category: "fire", lat: 13.0405, lng: 80.2337 });
  assert.equal(r[0].team.id, 3);
});

test("works without GPS (skill only)", () => {
  const r = rankTeams(teams, { category: "fire", lat: null, lng: null });
  assert.equal(r[0].team.id, 3);
  assert.equal(r[0].km, null);
});
