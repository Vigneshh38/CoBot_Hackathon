"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "@/components/Icon";
import { regenerateTrackTokenAction } from "../../actions";
import { agoText, liveState } from "@/lib/tracking";

function Replace() {
  const { pending } = useFormStatus();
  return <button className="btn text sm" disabled={pending}>{pending ? "Replacing…" : "Replace link"}</button>;
}

/** GPS status dot + a dialog with the team's private tracking link (open it on the vehicle's phone). */
export function TrackLink({ id, name, token, liveAt }: { id: number; name: string; token: string; liveAt: string | null }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const url = `${origin}/track/${token}`;
  const state = liveState(liveAt);
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* select manually */ } };

  return (
    <>
      <button type="button" className="btn text sm" onClick={() => { setOrigin(window.location.origin); setOpen(true); }} title={`GPS ${state === "offline" ? "offline" : agoText(liveAt)} · tracking link`}>
        <span className={`gps-dot ${state}`} />GPS
      </button>
      {open ? (
        <div className="dialog-backdrop" onClick={() => setOpen(false)} role="presentation">
          <div className="dialog wide" role="dialog" aria-modal="true" aria-label={`Tracking link for ${name}`} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-h">
              <button type="button" className="dialog-x" onClick={() => setOpen(false)} aria-label="Back"><Icon name="arrowLeft" className="ic sm" /></button>
              <h3>Live tracking · {name}</h3>
            </div>
            <p><span className={`gps-dot ${state}`} />{state === "offline" ? "No live GPS from this vehicle." : `Last GPS update ${agoText(liveAt)}.`}</p>
            <p className="muted" style={{ fontSize: 13 }}>Open this link on the vehicle&apos;s phone and tap <b>Start sharing location</b>. A built-in GPS unit can send to <code>POST /api/track</code> with this token instead. Anyone with the link can report this vehicle&apos;s position, so share it only with the crew.</p>
            <div className="track-url">
              <input className="input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Tracking link" />
              <button type="button" className="btn primary sm" onClick={copy}><Icon name={copied ? "check" : "send"} className="ic sm" />{copied ? "Copied" : "Copy"}</button>
            </div>
            <form action={regenerateTrackTokenAction} className="acts" style={{ marginTop: 12 }}>
              <input type="hidden" name="id" value={id} />
              <span className="muted" style={{ fontSize: 12, flex: 1 }}>Lost the phone? Replace the link; the old one stops working.</span>
              <Replace />
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
