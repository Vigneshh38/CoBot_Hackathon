"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { getDeviceId, getPosition, loadProfile, saveProfile, type Profile } from "@/lib/device";
import { startSiren, stopSiren } from "@/lib/siren";
import { offlineSmsText } from "@/lib/nearby";

const HOLD_MS = 3000; // hold to send: stops pocket taps, no other input needed
const PENDING_KEY = "resqure.pendingSos";
const PENDING_MAX_AGE_MS = 60 * 60_000; // an SOS queued offline is retried for up to 1 hour
/** Optional control-room number that receives offline SOS texts (e.g. a Twilio number). */
const CONTROL_SMS = process.env.NEXT_PUBLIC_SOS_SMS_NUMBER ?? "";

type Payload = Record<string, unknown> & { lat?: number; lng?: number; contactName?: string };
const savePending = (p: Payload) => { try { localStorage.setItem(PENDING_KEY, JSON.stringify({ at: Date.now(), p })); } catch { /* storage blocked */ } };
const clearPending = () => { try { localStorage.removeItem(PENDING_KEY); } catch { /* fine */ } };
function loadPending(): Payload | null {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null") as { at: number; p: Payload } | null;
    return v && Date.now() - v.at < PENDING_MAX_AGE_MS ? v.p : null;
  } catch { return null; }
}

/** sms: link that opens the phone's SMS app with the SOS text ready (works with only cell signal). */
function smsLink(p: Payload, family: string[]) {
  const to = [...family, CONTROL_SMS].filter(Boolean).join(",");
  return `sms:${to}?&body=${encodeURIComponent(offlineSmsText(p.contactName, p.lat, p.lng))}`;
}

interface Result { code: string; repeat?: boolean; nearby: number; admins: number; family: number; familyDemo: boolean; smsText: string }
type State =
  | { s: "idle" }
  | { s: "holding"; p: number }
  | { s: "sending"; step: string }
  | { s: "sent"; r: Result; gps: boolean }
  | { s: "offline"; sms: string; gps: boolean; hasTo: boolean }
  | { s: "error"; msg: string };

async function addressFor(lat: number, lng: number): Promise<string | undefined> {
  try {
    const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`, { signal: AbortSignal.timeout(2500) });
    return ((await res.json()) as { address?: string }).address;
  } catch {
    return undefined; // never wait long for a street name
  }
}

/** Hold-to-send SOS for someone who cannot fill the form: sends GPS + saved name/phone, alerts nearby people and family. */
export function SosButton() {
  const [st, setSt] = useState<State>({ s: "idle" });
  const [alarm, setAlarm] = useState(false);
  const [editing, setEditing] = useState(false);
  const frame = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (frame.current) clearInterval(frame.current); stopSiren(); }, []);

  // A plain timer (not animation frames): it keeps counting even if the browser throttles drawing.
  function startHold() {
    if (frame.current) return;
    const TICK = 50;
    let elapsed = 0;
    navigator.vibrate?.(40);
    setSt({ s: "holding", p: 0 });
    frame.current = setInterval(() => {
      elapsed += TICK;
      if (elapsed < HOLD_MS) return setSt({ s: "holding", p: elapsed / HOLD_MS });
      clearInterval(frame.current!);
      frame.current = null;
      navigator.vibrate?.([200, 100, 200]);
      void send();
    }, TICK);
  }

  function endHold() {
    if (!frame.current) return; // already sent (or never started)
    clearInterval(frame.current);
    frame.current = null;
    setSt({ s: "idle" });
  }

  async function send() {
    try { await (navigator as unknown as { wakeLock?: { request(t: string): Promise<unknown> } }).wakeLock?.request("screen"); } catch { /* optional */ }
    setSt({ s: "sending", step: "Getting your location…" });
    const pos = await getPosition(7000); // GPS works without internet (satellites)
    const p = loadProfile();
    let location: string | undefined;
    if (pos && navigator.onLine) {
      setSt({ s: "sending", step: "Alerting the control room and people nearby…" });
      location = await addressFor(pos.coords.latitude, pos.coords.longitude);
    }
    const payload: Payload = {
      deviceId: getDeviceId(), lat: pos?.coords.latitude, lng: pos?.coords.longitude, accuracy: pos?.coords.accuracy,
      location, contactName: p.name || undefined, contactPhone: p.phone || undefined, familyPhones: p.family,
    };
    if (!(await post(payload, !!pos))) goOffline(payload, p.family, !!pos);
  }

  /** Send to the server. Returns false only when there is no connection. */
  async function post(payload: Payload, gps: boolean): Promise<boolean> {
    if (!navigator.onLine) return false;
    let res: Response;
    try {
      res = await fetch("/api/sos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
    } catch {
      return false;
    }
    clearPending();
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setSt({ s: "error", msg: data.error ?? "Could not send SOS. Call 112 now." });
    else setSt({ s: "sent", r: data as Result, gps });
    return true;
  }

  /** No internet: keep the SOS to send later, and offer SMS (cell signal only) right now. */
  function goOffline(payload: Payload, family: string[], gps: boolean) {
    savePending(payload);
    setSt({ s: "offline", sms: smsLink(payload, family), gps, hasTo: family.length > 0 || !!CONTROL_SMS });
  }

  // A queued offline SOS is sent automatically as soon as the internet is back.
  useEffect(() => {
    const retry = () => { const q = loadPending(); if (q) void post(q, q.lat != null); };
    if (navigator.onLine) retry();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  async function toggleAlarm() {
    if (alarm) { stopSiren(); setAlarm(false); } else setAlarm(await startSiren());
  }

  async function share(r: Result) {
    const url = `${location.origin}/report/${r.code}`;
    try { await navigator.share?.({ title: "SOS: I need help", text: r.smsText, url }); } catch { /* cancelled */ }
  }

  const profile = typeof window === "undefined" ? null : loadProfile();
  const smsHref = (r: Result) => `sms:${(profile?.family ?? []).join(",")}?&body=${encodeURIComponent(r.smsText)}`;

  return (
    <section id="sos" className="sos card card-pad" aria-live="polite">
      {st.s === "idle" || st.s === "holding" ? (
        <>
          <button
            className={`sos-btn ${st.s === "holding" ? "holding" : ""}`}
            style={{ "--p": st.s === "holding" ? st.p : 0 } as React.CSSProperties}
            aria-describedby="sos-help"
            onPointerDown={(e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic event */ } startHold(); }}
            onPointerUp={endHold}
            onPointerCancel={endHold}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); startHold(); } }}
            onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") endHold(); }}
          >
            <span>{st.s === "holding" ? Math.ceil((1 - st.p) * (HOLD_MS / 1000)) : "SOS"}</span>
          </button>
          <p id="sos-help" className="sos-help">
            {st.s === "holding" ? <b>Keep holding… let go to cancel</b> : <><b>Press and hold for 3 seconds</b> to send your location to the control room, people within 3 km and your family.</>}
          </p>
          {st.s === "idle" ? <button className="btn text sm" onClick={() => setEditing(true)}><Icon name="edit" className="ic sm" />My SOS details</button> : null}
        </>
      ) : null}

      {st.s === "sending" ? (
        <>
          <div className="sos-btn sending" aria-hidden="true"><span>SOS</span></div>
          <p className="sos-help"><b>{st.step}</b></p>
        </>
      ) : null}

      {st.s === "sent" ? (
        <div className="sos-sent">
          <div className="success-ic"><Icon name="check" className="ic lg" /></div>
          <h2>{st.r.repeat ? "SOS sent again. Help is coming." : "SOS sent. Help is coming."}</h2>
          <ul className="sos-list">
            <li><Icon name="shield" className="ic sm" />Control room alerted (Critical)</li>
            <li><Icon name="people" className="ic sm" />{st.r.nearby ? `${st.r.nearby} ${st.r.nearby === 1 ? "person" : "people"} within 3 km alerted` : st.gps ? "No one with alerts on is near you right now" : "Location off, so nearby people could not be alerted"}</li>
            {st.r.family ? <li><Icon name="sms" className="ic sm" />{st.r.family} family {st.r.family === 1 ? "contact" : "contacts"} sent an SMS{st.r.familyDemo ? " (demo mode)" : ""}</li> : null}
          </ul>
          <div className="sos-actions">
            <button className={`btn block ${alarm ? "tonal" : "danger"}`} onClick={toggleAlarm}>
              <Icon name={alarm ? "mute" : "volume"} className="ic sm" />{alarm ? "Stop alarm" : "Sound loud alarm"}
            </button>
            <a href="tel:112" className="btn primary block"><Icon name="phone" className="ic sm" />Call 112</a>
            <div className="row2">
              {profile?.family.length ? <a href={smsHref(st.r)} className="btn tonal"><Icon name="sms" className="ic sm" />Text family</a> : null}
              <button className="btn tonal" onClick={() => share(st.r)}><Icon name="share" className="ic sm" />Share location</button>
            </div>
            <Link href={`/report/${st.r.code}`} className="btn text block">Track this SOS ({st.r.code})</Link>
          </div>
        </div>
      ) : null}

      {st.s === "offline" ? (
        <div className="sos-sent">
          <h2>No internet. Send your SOS by SMS</h2>
          <p className="sos-help">SMS works with only cell signal. {st.gps ? "Your GPS location is in the message." : "GPS is off, so add where you are."} Tap Send in your messages app.</p>
          <div className="sos-actions">
            <a href={st.sms} className="btn danger block sos-sms"><Icon name="sms" className="ic sm" />{st.hasTo ? "Send SOS by SMS" : "Send SOS by SMS (choose who)"}</a>
            <a href="tel:112" className="btn primary block"><Icon name="phone" className="ic sm" />Call 112</a>
            <button className="btn tonal block" onClick={toggleAlarm}>
              <Icon name={alarm ? "mute" : "volume"} className="ic sm" />{alarm ? "Stop alarm" : "Sound loud alarm"}
            </button>
          </div>
          <p className="hint">We will also send it to the control room automatically as soon as you are back online.</p>
        </div>
      ) : null}

      {st.s === "error" ? (
        <>
          <div className="err" role="alert">{st.msg}</div>
          <a href="tel:112" className="btn primary block"><Icon name="phone" className="ic sm" />Call 112</a>
          <button className="btn text block" onClick={() => setSt({ s: "idle" })}>Back</button>
        </>
      ) : null}

      {editing ? <SosDetails onClose={() => setEditing(false)} /> : null}
    </section>
  );
}

/** Name, phone and up to 3 family numbers, saved on this phone only. */
export function SosDetails({ onClose }: { onClose: () => void }) {
  const [p, setP] = useState<Profile>(() => loadProfile());
  const fam = [0, 1, 2].map((i) => p.family[i] ?? "");
  const setFam = (i: number, v: string) => setP({ ...p, family: fam.map((f, j) => (j === i ? v : f)) });

  function save(e: React.FormEvent) {
    e.preventDefault();
    saveProfile({ name: p.name.trim(), phone: p.phone.trim(), family: fam.map((f) => f.trim()).filter(Boolean) });
    onClose();
  }

  return (
    <div className="optin-backdrop" onClick={onClose}>
      <form className="optin form" onSubmit={save} onClick={(e) => e.stopPropagation()} aria-labelledby="sos-det-title">
        <h2 id="sos-det-title">My SOS details</h2>
        <p className="muted" style={{ margin: 0 }}>Saved on this phone only and sent with your SOS.</p>
        <div className="row2">
          <div className="field"><label htmlFor="sd-name">Your name</label><input id="sd-name" className="input" value={p.name} maxLength={80} onChange={(e) => setP({ ...p, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="sd-phone">Your phone</label><input id="sd-phone" className="input" type="tel" value={p.phone} maxLength={20} onChange={(e) => setP({ ...p, phone: e.target.value })} /></div>
        </div>
        <span className="label">Family to text in an SOS <span className="opt">(up to 3)</span></span>
        {fam.map((f, i) => (
          <input key={i} className="input" type="tel" placeholder={`Family number ${i + 1}`} value={f} maxLength={20} aria-label={`Family number ${i + 1}`} onChange={(e) => setFam(i, e.target.value)} />
        ))}
        <button className="btn primary block">Save</button>
        <button type="button" className="btn text block" onClick={onClose}>Cancel</button>
      </form>
    </div>
  );
}
