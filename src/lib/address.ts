type Addr = Record<string, string | undefined>;

/** Turn a Nominatim address object into a short, readable line: "Road, Area, City, PIN". */
export function shortAddress(a: Addr, fallback: string): string {
  const parts = [
    a.road ?? a.pedestrian ?? a.highway,
    a.neighbourhood ?? a.suburb ?? a.village ?? a.hamlet,
    a.city ?? a.town ?? a.county ?? a.state_district,
    a.postcode,
  ].filter((p): p is string => !!p);
  return parts.length >= 2 ? [...new Set(parts)].join(", ") : fallback;
}
