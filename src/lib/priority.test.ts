import { test } from "node:test";
import assert from "node:assert/strict";
import { peopleBonus, rankByPriority, scoreIncident, waitingBonus } from "./priority.ts";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const ago = (min: number) => new Date(NOW - min * 60000).toISOString();

test("people bonus is diminishing and capped at 15", () => {
  assert.equal(peopleBonus(1), 0);
  assert.equal(peopleBonus(2), 5);
  assert.equal(peopleBonus(4), 10);
  assert.equal(peopleBonus(8), 15);
  assert.equal(peopleBonus(500), 15);
});

test("waiting bonus grows to 30 at the respond-by deadline and stops", () => {
  assert.equal(waitingBonus("critical", 0), 0);
  assert.equal(waitingBonus("critical", 2.5), 15); // half of 5 min
  assert.equal(waitingBonus("critical", 5), 30);
  assert.equal(waitingBonus("low", 30), 15); // half of 60 min
  assert.equal(waitingBonus("low", 600), 30);
});

test("score adds all four parts and explains itself", () => {
  const p = scoreIncident({ severity: "critical", category: "fire", people_affected: 4, created_at: ago(2.5), team_id: null }, NOW);
  assert.equal(p.score, 100 + 10 + 15 + 8);
  assert.equal(p.reason, "Critical 100 + 4 people 10 + waiting 15 + category 8");
});

test("waiting bonus stops once a team is assigned", () => {
  const p = scoreIncident({ severity: "high", category: "other", people_affected: 1, created_at: ago(60), team_id: 3 }, NOW);
  assert.equal(p.score, 70);
});

test("a long-waiting medium incident can overtake a fresh high one (no starvation)", () => {
  const ranked = rankByPriority([
    { id: 1, severity: "high" as const, category: "other" as const, people_affected: 1, created_at: ago(0), team_id: null },
    { id: 2, severity: "medium" as const, category: "road_accident" as const, people_affected: 4, created_at: ago(40), team_id: null },
  ], NOW);
  // high: 70. medium: 40 + 10 people + 30 waiting + 4 category = 84.
  assert.deepEqual(ranked.map((r) => r.id), [2, 1]);
});

test("ties go to the earlier report", () => {
  const base = { severity: "low" as const, category: "other" as const, people_affected: 1, team_id: 1 };
  const ranked = rankByPriority([{ ...base, id: "b", created_at: ago(1) }, { ...base, id: "a", created_at: ago(5) }], NOW);
  assert.deepEqual(ranked.map((r) => r.id), ["a", "b"]);
});
