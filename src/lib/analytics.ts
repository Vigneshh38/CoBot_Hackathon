/** Pure helpers for the analytics charts (unit-tested; no database access). */

export interface HourBucket { start: number; label: string; n: number }

/** Count timestamps into 24 one-hour buckets ending at the current hour (oldest first). */
export function hourlyBuckets(isoTimes: string[], now = Date.now()): HourBucket[] {
  const HOUR = 3600_000;
  const end = Math.floor(now / HOUR) * HOUR; // start of the current hour
  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, i) => {
    const start = end - (23 - i) * HOUR;
    const d = new Date(start);
    return { start, label: `${String(d.getHours()).padStart(2, "0")}:00`, n: 0 };
  });
  for (const t of isoTimes) {
    const i = 23 - Math.floor((end - Math.floor(new Date(t).getTime() / HOUR) * HOUR) / HOUR);
    if (i >= 0 && i < 24) buckets[i].n++;
  }
  return buckets;
}

/** Average minutes between two timestamps, rounded; null when there is no data. */
export function averageMinutes(pairs: { from: string; to: string }[]): number | null {
  const mins = pairs.map((p) => (new Date(p.to).getTime() - new Date(p.from).getTime()) / 60000).filter((m) => m >= 0);
  if (!mins.length) return null;
  return Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
}

/** "45 min", "2 h 5 min", or "—". */
export function formatMinutes(m: number | null): string {
  if (m == null) return "—";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
