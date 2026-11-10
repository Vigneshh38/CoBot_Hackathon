"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { agoText } from "@/lib/tracking";
import type { TrackedTeam } from "@/lib/incidents";

type Job = TrackedTeam["job"];
type State = { s: "idle" } | { s: "starting" } | { s: "on" } | { s: "error"; msg: string };

const SEND_EVERY_MS = 3000; // the server also drops fixes closer than 2 s

/** Shares this phone's GPS with the control room while switched on (watchPosition → POST /api/track). */
export function Tracker({ token, initialJob }: { token: string; initialJob: Job }) {
  const [st, setSt] = useState<State>({ s: "idle" });
  const [job, setJob] = useState<Job>(initialJob);
  const [last, setLast] = useState<{ at: string; accuracy: number | null; arrived: boolean } | null>(null);
  const [, setTick] = useState(0);
  const watch = useRef<number | null>(null);
  const lastSent = useRef(0);
  const lock = useRef<{ release: () => Promise<void> } | null>(null);

  const stop = () => {
    if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    lock.current?.release().catch(() => {});
    lock.current = null;
    setSt({ s: "idle" });
  };

  const start = async () => {
    if (!("geolocation" in navigator)) { setSt({ s: "error", msg: "This device has no GPS / location support." }); return; }
    setSt({ s: "starting" });
    try { lock.current = await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null; } catch { /* optional */ }
    watch.current = navigator.geolocation.watchPosition(
      async (pos) => {
        setSt({ s: "on" });
        const now = Date.now();
        if (now - lastSent.current < SEND_EVERY_MS) return;
        lastSent.current = now;
        const c = pos.coords;
        try {
          const res = await fetch("/api/track", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, speed: c.speed ?? undefined, heading: c.heading ?? undefined, at: pos.timestamp }),
          });
          if (res.status === 401) { stop(); setSt({ s: "error", msg: "This link was replaced. Ask the control room for the new one." }); return; }
          const d = await res.json();
          setJob(d.job ?? null);
          setLast({ at: new Date().toISOString(), accuracy: c.accuracy, arrived: !!d.arrived });
        } catch { /* offline: the next fix will try again */ }
      },
      (err) => setSt({ s: "error", msg: err.code === err.PERMISSION_DENIED ? "Location permission was denied. Allow location for this site and try again." : "Could not get a GPS fix. Move to open sky and try again." }),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
  };

  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 1000); return () => { clearInterval(t); if (watch.current != null) navigator.geolocation.clearWatch(watch.current); }; }, []);

  const on = st.s === "on" || st.s === "starting";
  return (
    <>
      <section className="card card-pad track-status">
        <div className="ts-row">
          <span className={`gps-dot ${st.s === "on" ? "live" : "offline"}`} />
          <b>{st.s === "on" ? "Sharing live location" : st.s === "starting" ? "Getting GPS fix…" : "Location sharing is off"}</b>
        </div>
        {last ? <p className="muted">Last sent {agoText(last.at)}{last.accuracy != null ? ` · ±${Math.round(last.accuracy)} m` : ""}</p> : null}
        {st.s === "error" ? <p className="err" role="alert">{st.msg}</p> : null}
        {on ? (
          <button className="btn tonal block" onClick={stop}>Stop sharing</button>
        ) : (
          <button className="btn primary block" onClick={start}><Icon name="gps" className="ic sm" />Start sharing location</button>
        )}
        <p className="muted" style={{ fontSize: 12 }}>Keep this page open while on duty. Your position is sent only to the control room.</p>
      </section>

      <section className="card card-pad">
        <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Current task</h2>
        {job ? (
          <>
            <b>#{job.id} {job.title}</b>
            <p className="muted" style={{ margin: "4px 0 12px" }}><Icon name="pin" className="ic sm" />{job.location}</p>
            {last?.arrived ? <div className="banner"><Icon name="check" />You are at the scene.</div> : null}
            {job.lat != null && job.lng != null ? (
              <a className="btn primary block" href={`https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}&travelmode=driving`} target="_blank" rel="noopener noreferrer">
                <Icon name="send" className="ic sm" />Navigate
              </a>
            ) : null}
          </>
        ) : <p className="muted" style={{ margin: 0 }}>No task assigned. Stay available.</p>}
      </section>
    </>
  );
}
