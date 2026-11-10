import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanServices, displayName, isGovernmentHospital, nearestService } from "./services.ts";

test("government hospital filter", () => {
  assert.equal(isGovernmentHospital({ name: "Rajiv Gandhi Government General Hospital" }), true);
  assert.equal(isGovernmentHospital({ name: "Govt. Stanley Hospital" }), true);
  assert.equal(isGovernmentHospital({ name: "சைதாப்பேட்டை அரசு மருத்துவமனை" }), true);
  assert.equal(isGovernmentHospital({ name: "ESI Hospital" }), true);
  assert.equal(isGovernmentHospital({ name: "Apollo Hospital" }), false);
  assert.equal(isGovernmentHospital({ name: "Ayesha Hospital, Kilpauk" }), false);
  assert.equal(isGovernmentHospital({ name: "SRM Medical College Hospital" }), false);
  assert.equal(isGovernmentHospital({ name: "Government Veterinary Hospital" }), false);
  assert.equal(isGovernmentHospital({ name: "Malar Clinic", "operator:type": "public", emergency: "no" }), false);
  assert.equal(isGovernmentHospital({ name: "Gynmc PG Block", "operator:type": "government", "healthcare:speciality": "yoga_and_naturopathy" }), false);
});

test("names are tidied and filled in", () => {
  assert.equal(displayName("fire", { name: "Teynampet FS" }), "Teynampet Fire Station");
  assert.equal(displayName("police", { name: "Royapettah PS" }), "Royapettah Police Station");
  assert.equal(displayName("fire", {}), "Fire station");
  assert.equal(displayName("fire", { name: "Fire service station;Fire Force Service center" }), "Fire service station");
});

test("clean: keeps services, drops private hospitals and duplicates", () => {
  const s = cleanServices([
    { type: "node", id: 1, lat: 13.05, lon: 80.25, tags: { amenity: "fire_station", name: "Egmore FS", phone: "101" } },
    { type: "way", id: 2, center: { lat: 13.1, lon: 80.28 }, tags: { amenity: "hospital", name: "Stanley Medical College and Hospital" } },
    { type: "node", id: 3, lat: 13.1005, lon: 80.2802, tags: { amenity: "hospital", name: "Stanley Medical College and Hospital" } }, // same place
    { type: "node", id: 4, lat: 13.0, lon: 80.2, tags: { amenity: "hospital", name: "Apollo Hospital" } },
    { type: "node", id: 5, tags: { amenity: "police", name: "No coordinates PS" } },
    { type: "node", id: 6, lat: 13.03, lon: 80.24, tags: { amenity: "cafe" } },
  ]);
  assert.deepEqual(s.map((x) => [x.kind, x.name]), [["fire", "Egmore Fire Station"], ["hospital", "Stanley Medical College and Hospital"]]);
  assert.equal(s[0].phone, "101");
});

test("nearest service of a kind", () => {
  const list = cleanServices([
    { type: "node", id: 1, lat: 13.0, lon: 80.2, tags: { amenity: "fire_station", name: "A" } },
    { type: "node", id: 2, lat: 13.1, lon: 80.2, tags: { amenity: "fire_station", name: "B" } },
    { type: "node", id: 3, lat: 13.09, lon: 80.2, tags: { amenity: "police", name: "C" } },
  ]);
  const n = nearestService(list, "fire", { lat: 13.08, lng: 80.2 });
  assert.equal(n?.name, "B");
  assert.ok(n!.km > 2 && n!.km < 2.5);
  assert.equal(nearestService(list, "ambulance", { lat: 13, lng: 80 }), null);
});
