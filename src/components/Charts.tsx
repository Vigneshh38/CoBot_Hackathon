import Link from "next/link";
import type { HourBucket } from "@/lib/analytics";

/**
 * Small server-rendered SVG/HTML charts for the analytics section.
 * One hue (sandalwood) for plain counts; severity colours only where they carry meaning.
 * Every value is also written as text, so nothing depends on colour alone.
 */

export interface BarItem { key: string; label: string; value: number; tone?: string; href?: string }

/** Horizontal bars with the label on the left and the count on the right. */
export function BarList({ items, caption }: { items: BarItem[]; caption: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="chart-bars" role="table" aria-label={caption}>
      {items.map((i) => {
        const row = (
          <>
            <span className="cb-label" role="cell">{i.label}</span>
            <span className="cb-track" role="cell"><i className={i.tone ? `tone-${i.tone}` : ""} style={{ width: `${(i.value / max) * 100}%` }} /></span>
            <b role="cell">{i.value}</b>
          </>
        );
        return i.href
          ? <Link key={i.key} href={i.href} className="cb-row" role="row" title={`${i.label}: ${i.value}`}>{row}</Link>
          : <div key={i.key} className="cb-row" role="row" title={`${i.label}: ${i.value}`}>{row}</div>;
      })}
    </div>
  );
}

/** A single-value ring (e.g. team utilisation) with the number in the middle. */
export function Ring({ value, total, label, sub }: { value: number; total: number; label: string; sub: string }) {
  const r = 42, c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  return (
    <div className="ring-wrap">
      <svg viewBox="0 0 100 100" className="ring" role="img" aria-label={`${label}: ${value} of ${total}`}>
        <circle cx="50" cy="50" r={r} className="ring-track" />
        <circle cx="50" cy="50" r={r} className="ring-fill" strokeDasharray={`${pct * c} ${c}`} transform="rotate(-90 50 50)" />
        <text x="50" y="48" className="ring-val">{Math.round(pct * 100)}%</text>
        <text x="50" y="63" className="ring-sub">{value} of {total}</text>
      </svg>
      <div className="ring-legend">
        <b>{label}</b>
        <span className="muted">{sub}</span>
      </div>
    </div>
  );
}

/** 24 hourly columns; hover a column to see its count. */
export function HourlyColumns({ buckets }: { buckets: HourBucket[] }) {
  const W = 480, H = 140, pad = { l: 22, r: 4, t: 16, b: 20 };
  const max = Math.max(1, ...buckets.map((b) => b.n));
  const step = (W - pad.l - pad.r) / buckets.length;
  const bw = Math.max(4, step - 4); // 4px gap between columns
  const y = (n: number) => pad.t + (H - pad.t - pad.b) * (1 - n / max);
  const total = buckets.reduce((s, b) => s + b.n, 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="hourly" role="img" aria-label={`Reports per hour, last 24 hours: ${total} in total`}>
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} className="axis" />
      <text x={pad.l - 6} y={pad.t + 4} className="tick" textAnchor="end">{max}</text>
      <text x={pad.l - 6} y={H - pad.b} className="tick" textAnchor="end">0</text>
      {buckets.map((b, i) => {
        const x = pad.l + i * step + (step - bw) / 2;
        const top = y(b.n);
        return (
          <g key={b.start} className="col">
            <title>{`${b.label}: ${b.n} report${b.n === 1 ? "" : "s"}`}</title>
            <rect x={pad.l + i * step} y={pad.t} width={step} height={H - pad.t - pad.b} className="hit" />
            {b.n > 0 ? <rect x={x} y={top} width={bw} height={H - pad.b - top} rx="3" className="bar" /> : null}
            <text x={x + bw / 2} y={top - 4} className="col-val" textAnchor="middle">{b.n}</text>
            {i % 6 === 0 || i === buckets.length - 1 ? <text x={x + bw / 2} y={H - 6} className="tick" textAnchor="middle">{i === buckets.length - 1 ? "now" : b.label}</text> : null}
          </g>
        );
      })}
    </svg>
  );
}
