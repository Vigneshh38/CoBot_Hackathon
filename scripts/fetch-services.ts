/**
 * Builds src/data/chennai-services.json: government emergency services in and around Chennai
 * (fire stations, police stations, government hospitals) from OpenStreetMap via the Overpass API.
 * Data © OpenStreetMap contributors, ODbL. Run again to refresh:
 *   node scripts/fetch-services.ts            (fetch from Overpass)
 *   node scripts/fetch-services.ts raw.json   (reuse a saved Overpass response)
 */
import fs from "node:fs";
import path from "node:path";
import { cleanServices, type OsmElement } from "../src/lib/services.ts";

const BBOX = "12.80,80.00,13.30,80.35"; // Greater Chennai + suburbs (south, west, north, east)
const QUERY = `[out:json][timeout:90];(
  nwr["amenity"="fire_station"](${BBOX});
  nwr["amenity"="police"](${BBOX});
  nwr["emergency"="ambulance_station"](${BBOX});
  nwr["amenity"="hospital"](${BBOX});
);out center tags;`;

async function load(): Promise<OsmElement[]> {
  const file = process.argv[2];
  if (file) return JSON.parse(fs.readFileSync(file, "utf8")).elements;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "resqure-hackathon-app" },
    body: new URLSearchParams({ data: QUERY }),
  });
  if (!res.ok) throw new Error(`Overpass error ${res.status}`);
  return (await res.json()).elements;
}

const services = cleanServices(await load());
const out = path.join(import.meta.dirname, "..", "src", "data", "chennai-services.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({
  source: "OpenStreetMap contributors (ODbL), via Overpass API",
  fetched: new Date().toISOString().slice(0, 10),
  services,
}, null, 0).replace(/\},\{/g, "},\n{") + "\n");
const count = (k: string) => services.filter((s) => s.kind === k).length;
console.log(`Saved ${services.length} services: ${count("fire")} fire, ${count("police")} police, ${count("hospital")} government hospitals, ${count("ambulance")} ambulance -> ${out}`);
