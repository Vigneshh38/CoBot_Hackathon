"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { startSiren, stopSiren } from "@/lib/siren";

interface Alert { title: string; body: string; url: string }

/**
 * When an SOS push arrives while the site is open, the service worker forwards it here and we take over
 * the screen with a red alert and a loud siren. (When the site is closed, the phone shows the notification.)
 */
export function AlertOverlay() {
  const path = usePathname();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [sound, setSound] = useState<"on" | "blocked" | "off">("off");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMsg = async (e: MessageEvent) => {
      if (e.data?.type !== "resqure-alert" || e.data.kind !== "sos") return;
      setAlert({ title: e.data.title, body: e.data.body, url: e.data.url });
      setSound((await startSiren()) ? "on" : "blocked");
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);

  // The admin panel and the alert page have their own alarm handling.
  if (!alert || path.startsWith("/admin") || path.startsWith("/alert")) return null;

  const close = () => { stopSiren(); setSound("off"); setAlert(null); };

  return (
    <div className="sos-overlay" role="alertdialog" aria-modal="true" aria-labelledby="sos-ov-title">
      <div className="sos-overlay-pulse" aria-hidden="true"><Icon name="warn" className="ic lg" /></div>
      <h1 id="sos-ov-title">{alert.title}</h1>
      <p>{alert.body}</p>
      <a href={alert.url} className="btn block sos-white" onClick={() => stopSiren()}><Icon name="navigate" className="ic sm" />See where</a>
      {sound === "blocked" ? (
        <button className="btn block sos-ghost" onClick={async () => setSound((await startSiren()) ? "on" : "blocked")}><Icon name="volume" className="ic sm" />Sound alarm</button>
      ) : null}
      <button className="btn block sos-ghost" onClick={close}><Icon name="mute" className="ic sm" />{sound === "on" ? "Stop alarm and close" : "Close"}</button>
    </div>
  );
}
