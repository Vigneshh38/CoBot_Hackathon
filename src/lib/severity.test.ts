import { test } from "node:test";
import assert from "node:assert/strict";
import { classifySeverity, peoplePoints, pointsToSeverity } from "./severity.ts";

test("people points bands", () => {
  assert.equal(peoplePoints(0), 0);
  assert.equal(peoplePoints(1), 0);
  assert.equal(peoplePoints(2), 1);
  assert.equal(peoplePoints(6), 2);
  assert.equal(peoplePoints(25), 3);
});

test("points map to the four levels", () => {
  assert.equal(pointsToSeverity(0), "low");
  assert.equal(pointsToSeverity(2), "medium");
  assert.equal(pointsToSeverity(4), "high");
  assert.equal(pointsToSeverity(6), "critical");
});

test("minor road incident with one person is low", () => {
  assert.equal(classifySeverity({ category: "road_accident", peopleAffected: 1, text: "small scratch, cars stopped" }).severity, "low");
});

test("road accident with injured people is medium", () => {
  assert.equal(classifySeverity({ category: "road_accident", peopleAffected: 3, text: "two bikes, rider injured" }).severity, "medium");
});

test("fire with people trapped is critical", () => {
  const r = classifySeverity({ category: "fire", peopleAffected: 4, text: "House fire, family trapped inside" });
  assert.equal(r.severity, "critical");
  assert.ok(r.reasons.some((x) => x.includes("trapped")));
});

test("building collapse with many people is critical even without keywords", () => {
  assert.equal(classifySeverity({ category: "building_collapse", peopleAffected: 30, text: "old building" }).severity, "critical");
});

test("flood affecting a street is high", () => {
  assert.equal(classifySeverity({ category: "flood", peopleAffected: 10, text: "water entering houses, families stranded" }).severity, "high");
});

test("keyword matching is case-insensitive", () => {
  assert.equal(classifySeverity({ category: "medical", peopleAffected: 1, text: "Man UNCONSCIOUS at bus stop" }).severity, "high");
});
