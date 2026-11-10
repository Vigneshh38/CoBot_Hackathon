"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { getPosition, locationAllowed } from "@/lib/device";
import { distanceKm } from "@/lib/dispatch";
import { formatDistance } from "@/lib/nearby";
import { timeAgo } from "@/lib/time";
import { startSiren, stopSiren } from "@/lib/siren";

interface Props {
  code: string; ended: boolean; location: string; lat: number | null; lng: number | null;
  createdAt: string; helpers: number; teamOnWay: boolean;
}

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const noop = () => () => {};

export function AlertView(p: Props) {
  const [sound, setSound] = useState<"on" | "off" | "blocked">("off");
  const [km, setKm] = useState<number | null>(null);
  const [helpers, setHelpers] = useState(p.helpers);
  const wentBefore = useSyncExternalStore(noop, () => read(`resqure.going.${p.code}`) === "1", () => false);
  const [wentNow, setWentNow] = useState(false);
  const going = wentBefore || wentNow;

  useEffect(() => {
    if (p.ended) return;
    void startSiren().then((ok) => setSound(ok ? "on" : "blocked")); // blocked until the page is tapped once
    (async () => {
      if (p.lat == null || p.lng == null || !(await locationAllowed())) return;
      const pos = await getPosition(6000);
      if (pos) setKm(distanceKm({ lat: pos.coords.latitude, lng: pos.coords.longitude }, { lat: p.lat, lng: p.lng }));
    })();
    return () => stopSiren();
  }, [p.ended, p.code, p.lat, p.lng]);

  async function toggle() {
    if (sound === "on") { stopSiren(); setSound("off"); } else setSound((await startSiren()) ? "on" : "blocked");
  }

  async function imGoing() {
    stopSiren(); setSound("off");
    const res = await fetch(`/api/alert/${p.code}/help`, { method: "POST" });
    if (res.ok) setHelpers(((await res.json()) as { helpers: number }).helpers);
    try { localStorage.setItem(`resqure.going.${p.code}`, "1"); } catch { /* fine */ }
    setWentNow(true);
  }

  if (p.ended) {
    return (
      <main className="page narrow">
        <section className="card card-pad" style={{ textAlign: "center" }}>
          <div className="success-ic"><Icon name="check" className="ic lg" /></div>
          <h1>This SOS has ended</h1>
          <p className="lead">The control room has handled it, or it is more than 6 hours old. Thank you for caring.</p>
          <Link href="/" className="btn tonal" style={{ marginTop: 16 }}>Go to ResQure</Link>
        </section>
      </main>
    );
  }

  const dir = p.lat != null && p.lng != null ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}` : null;

  return (
    <main className="sos-overlay static" onClick={() => { if (sound === "blocked") void toggle(); }}>
      <div className="sos-overlay-pulse" aria-hidden="true"><Icon name="warn" className="ic lg" /></div>
      <h1>Someone near you needs help</h1>
      <p className="sos-where"><Icon name="pin" className="ic sm" />{p.location}</p>
      <p>{km != null ? `${formatDistance(km)} from you · ` : ""}SOS sent {timeAgo(p.createdAt)}{p.teamOnWay ? " · a response team is on the way" : ""}</p>
      {helpers ? <p><b>{helpers} {helpers === 1 ? "person is" : "people are"} going to help</b></p> : null}

      {dir ? <a href={dir} target="_blank" rel="noopener noreferrer" className="btn block sos-white"><Icon name="navigate" className="ic sm" />Get directions</a> : null}
      {going
        ? <p className="sos-going"><Icon name="check" className="ic sm" />Thanks. The control room knows you are going.</p>
        : <button className="btn block sos-white" onClick={imGoing}><Icon name="people" className="ic sm" />I&apos;m going to help</button>}
      <a href="tel:112" className="btn block sos-ghost"><Icon name="phone" className="ic sm" />Call 112</a>
      <button className="btn block sos-ghost" onClick={(e) => { e.stopPropagation(); void toggle(); }}>
        <Icon name={sound === "on" ? "mute" : "volume"} className="ic sm" />{sound === "on" ? "Stop alarm" : sound === "blocked" ? "Tap to sound alarm" : "Sound alarm"}
      </button>
      <p className="sos-safety">Only go if it is safe for you. Do not enter fire, deep water or a damaged building. Wait for trained help.</p>
    </main>
  );
}
