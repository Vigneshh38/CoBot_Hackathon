/**
 * Government emergency services (fire, police, government hospitals, ambulance bases) from OpenStreetMap.
 * Pure helpers, unit-tested; the data file is built by scripts/fetch-services.ts.
 */
import { distanceKm } from "./dispatch.ts";

export type ServiceKind = "fire" | "police" | "hospital" | "ambulance";

export interface Service { id: string; kind: ServiceKind; name: string; lat: number; lng: number; phone?: string }

export const SERVICE_LABELS: Record<ServiceKind, string> = {
  fire: "Fire station", police: "Police station", hospital: "Government hospital", ambulance: "Ambulance base",
};

export interface OsmElement {
  type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

// A hospital counts as government-run when its name/operator says so (OSM rarely sets operator:type).
const GOVT = /government|govt|\bgov\b|அரசு|\bgh\b|primary health|urban health|\bu?phc\b|\besi\b|state insurance|corporation|stanley medical|kilpauk medical|rajiv gandhi|omandurar|thoracic|^tb hospital|institute of child health|rsrm/i;
const NOT_EMERGENCY = /veterinary|dental|unani|siddha|ayurved|homoeo|naturopathy|yoga|indian medicine/i;
const PRIVATE_COLLEGE = /\b(acs|srm|tagore|saveetha|muthukumaran|balaji|vels|madha|sathish)\b/i;

export function kindOf(tags: Record<string, string>): ServiceKind | null {
  if (tags.amenity === "fire_station") return "fire";
  if (tags.amenity === "police") return "police";
  if (tags.emergency === "ambulance_station") return "ambulance";
  if (tags.amenity === "hospital") return isGovernmentHospital(tags) ? "hospital" : null;
  return null;
}

export function isGovernmentHospital(tags: Record<string, string>): boolean {
  const text = [tags.name, tags["name:en"], tags.operator, tags["operator:type"], tags["healthcare:speciality"]].filter(Boolean).join(" ");
  if (tags["operator:type"] === "private" || tags.emergency === "no" || NOT_EMERGENCY.test(text) || PRIVATE_COLLEGE.test(text)) return false;
  return tags["operator:type"] === "government" || GOVT.test(text); // "public" alone is often mis-tagged
}

/** Tidy names like "Teynampet FS" / "Royapettah PS" and fill in missing ones. */
export function displayName(kind: ServiceKind, tags: Record<string, string>): string {
  let n = (tags["name:en"] || tags.name || "").split(";")[0].trim();
  n = n.replace(/\bFS$/i, "Fire Station").replace(/\bPS$/i, "Police Station");
  return n || SERVICE_LABELS[kind];
}

/** OSM elements → clean, de-duplicated services (same kind + same name within 300 m = one place). */
export function cleanServices(elements: OsmElement[]): Service[] {
  const out: Service[] = [];
  for (const e of elements) {
    const tags = e.tags ?? {};
    const kind = kindOf(tags);
    const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
    if (!kind || lat == null || lng == null) continue;
    const name = displayName(kind, tags);
    const dup = out.find((s) => s.kind === kind && s.name.toLowerCase() === name.toLowerCase() && distanceKm(s, { lat, lng }) < 0.3);
    if (dup) continue;
    const phone = (tags.phone || tags["contact:phone"] || "").split(";")[0].trim() || undefined;
    out.push({ id: `${e.type[0]}${e.id}`, kind, name, lat: +lat.toFixed(6), lng: +lng.toFixed(6), ...(phone ? { phone } : {}) });
  }
  return out.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

/** Nearest service of a kind to a point (for "nearest fire station: 1.2 km"). */
export function nearestService(services: Service[], kind: ServiceKind, at: { lat: number; lng: number }): (Service & { km: number }) | null {
  let best: (Service & { km: number }) | null = null;
  for (const s of services) {
    if (s.kind !== kind) continue;
    const km = distanceKm(at, s);
    if (!best || km < best.km) best = { ...s, km };
  }
  return best;
}
