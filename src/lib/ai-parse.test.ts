import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAiReply, reportSchema } from "./validation.ts";

test("AI: accepts a valid reply wrapped in prose / code fences", () => {
  const r = parseAiReply('Here you go:\n```json\n{"category":"fire","severity":"critical","summary":"House fire","reason":"Flames and trapped people","confidence":92}\n```');
  assert.equal(r?.severity, "critical");
});

test("AI: rejects unknown severity values (e.g. injected text)", () => {
  assert.equal(parseAiReply('{"category":"fire","severity":"ignore previous","summary":"x","reason":"y","confidence":50}'), null);
});

test("AI: rejects non-JSON replies", () => {
  assert.equal(parseAiReply("I cannot help with that."), null);
});

test("AI: rejects confidence out of range", () => {
  assert.equal(parseAiReply('{"category":"flood","severity":"low","summary":"x","reason":"y","confidence":500}'), null);
});

test("Report: title and name are optional, phone is required", () => {
  const base = { description: "Car hit a tree", category: "road_accident", location: "OMR, Chennai", peopleAffected: "2" };
  assert.equal(reportSchema.safeParse(base).success, false);
  const r = reportSchema.safeParse({ ...base, contactPhone: "+91 98400 12345" });
  assert.ok(r.success);
  assert.equal(r.data?.title, undefined);
  assert.equal(r.data?.peopleAffected, 2);
});

test("Report: rejects missing description, bad category and zero people", () => {
  const r = reportSchema.safeParse({ description: "", category: "alien", location: "x", peopleAffected: "0" });
  assert.equal(r.success, false);
  const fields = new Set(r.error?.issues.map((i) => i.path[0]));
  for (const f of ["description", "category", "location", "peopleAffected"]) assert.ok(fields.has(f), f);
});

test("Report: rejects an invalid phone number", () => {
  const r = reportSchema.safeParse({ description: "Fire in shop", category: "fire", location: "T Nagar", peopleAffected: 1, contactPhone: "abc" });
  assert.equal(r.success, false);
});

import { shortAddress } from "./address.ts";

test("Address: builds a short readable line from GPS lookup", () => {
  assert.equal(shortAddress({ road: "Usman Road", suburb: "T. Nagar", city: "Chennai", postcode: "600017" }, "x"), "Usman Road, T. Nagar, Chennai, 600017");
});

test("Address: falls back when the lookup has too little detail", () => {
  assert.equal(shortAddress({ state: "Tamil Nadu" }, "Near Chennai"), "Near Chennai");
});

test("AI: long summaries are trimmed, not rejected", () => {
  const long = "x".repeat(600);
  const r = parseAiReply(`{"category":"fire","severity":"high","summary":"${long}","reason":"${long}","confidence":80}`);
  assert.ok(r && r.summary.length <= 300 && r.reason.length <= 400);
});
