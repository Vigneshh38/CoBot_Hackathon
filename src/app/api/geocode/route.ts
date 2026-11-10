import { NextRequest } from "next/server";
import { shortAddress } from "@/lib/address";

/**
 * Reverse geocoding: GPS point -> readable address, via OpenStreetMap Nominatim (free, no key).
 * Done on our server so we can send a proper User-Agent (Nominatim policy) and cache results.
 */
const cache = new Map<string, string>();
let lastCall = 0;

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Response.json({ error: "Invalid coordinates" }, { status: 400 });
  }
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`; // ~11 m grid
  const hit = cache.get(key);
  if (hit) return Response.json({ address: hit });

  // Nominatim allows ~1 request/second.
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`;
    const res = await fetch(url, { headers: { "User-Agent": "ResQureEmergencyPlatform/0.1 (hackathon prototype)" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data = (await res.json()) as { display_name?: string; address?: Record<string, string | undefined> };
    const address = shortAddress(data.address ?? {}, data.display_name?.split(",").slice(0, 4).join(",").trim() || "");
    if (!address) throw new Error("No address");
    cache.set(key, address);
    return Response.json({ address });
  } catch {
    return Response.json({ error: "Address lookup failed" }, { status: 502 });
  }
}
