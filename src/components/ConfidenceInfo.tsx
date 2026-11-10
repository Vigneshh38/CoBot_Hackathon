import { Icon } from "./Icon";

/** Small "i" icon; on hover/focus shows the analysis confidence as a filled ring. Pure CSS, no JS. */
export function ConfidenceInfo({ value }: { value: number | null }) {
  if (value == null) return null;
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <span className="conf-info" tabIndex={0} role="img" aria-label={`Confidence ${v}%`}>
      <Icon name="info" className="ic sm" />
      <span className="conf-pop" aria-hidden="true">
        <span className="conf-ring" style={{ "--p": v } as React.CSSProperties}><b>{v}%</b></span>
        <span className="conf-label">Confidence</span>
      </span>
    </span>
  );
}
