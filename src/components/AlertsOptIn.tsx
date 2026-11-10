"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { getPosition, locationAllowed, pushSupport, syncPush } from "@/lib/device";

type View = "hidden" | "ask" | "ios" | "denied" | "busy" | "done" | "noloc" | "noloc-busy" | "noloc-failed";

/**
 * Asks every visitor to turn on SOS alerts (notifications + location), on every visit until they allow it.
 * It never blocks the page: SOS and the call buttons stay usable, and the card has its own SOS/112 shortcuts.
 * Once allowed, each visit silently refreshes the subscription and the last known location.
 */
export function AlertsOptIn() {
  const [view, setView] = useState<View>("hidden");

  useEffect(() => {
    let alive = true;
    (async () => {
      const support = pushSupport();
      if (support === "unsupported") return;
      if (support === "ios-install") return alive && setView("ios");
      if (Notification.permission === "denied") return alive && setView("denied");
      if (Notification.permission === "default") return alive && setView("ask");
      // Already allowed: refresh quietly (location only if it was already allowed, so no prompt).
      const pos = (await locationAllowed()) ? await getPosition(6000) : null;
      await syncPush("citizen", pos);
      // Without a location this phone can never be "nearby", so say so and offer to share it.
      if (!pos && alive) setView("noloc");
    })();
    return () => { alive = false; };
  }, []);

  async function turnOn() {
    setView("busy");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return setView(perm === "denied" ? "denied" : "ask");
    const pos = await getPosition(10000); // asks for location so we know who is "nearby"
    const ok = await syncPush("citizen", pos);
    if (!ok) return setView("ask");
    if (!pos) return setView("noloc");
    setView("done");
    setTimeout(() => setView("hidden"), 2500);
  }

  async function shareLocation() {
    setView("noloc-busy");
    const pos = await getPosition(10000);
    if (!pos) return setView("noloc-failed");
    await syncPush("citizen", pos);
    setView("done");
    setTimeout(() => setView("hidden"), 2500);
  }

  if (view === "hidden") return null;

  if (view === "noloc" || view === "noloc-busy" || view === "noloc-failed") {
    return (
      <div className="optin-strip warn" role="status">
        <Icon name="gps" className="ic sm" />
        <span>
          {view === "noloc-failed"
            ? "We still can't get your location. Turn on Location (GPS) on your phone and allow location for this site in your browser settings, then try again."
            : "SOS alerts are on, but your location is off, so you won't be alerted when someone near you needs help."}
          <button className="btn tonal sm" onClick={shareLocation} disabled={view === "noloc-busy"}>
            {view === "noloc-busy" ? "Getting location…" : view === "noloc-failed" ? "Try again" : "Share my location"}
          </button>
        </span>
      </div>
    );
  }

  if (view === "denied") {
    return (
      <div className="optin-strip" role="status">
        <Icon name="bell" className="ic sm" />
        <span>SOS alerts are blocked on this browser. To help people near you, allow notifications for this site in your browser settings.</span>
      </div>
    );
  }

  const sosLink = (
    <div className="optin-quick">
      <a href="/sos" className="btn danger sm">Need help now? SOS</a>
      <a href="tel:112" className="btn tonal sm"><Icon name="phone" className="ic sm" />Call 112</a>
    </div>
  );

  return (
    <div className="optin-backdrop">
      <div className="optin" role="dialog" aria-modal="true" aria-labelledby="optin-title">
        <div className="optin-ic"><Icon name="bell" className="ic lg" /></div>
        {view === "ios" ? (
          <>
            <h2 id="optin-title">Add ResQure to your Home Screen</h2>
            <p>On iPhone, alerts only work from the Home Screen app. Tap <b>Share</b>, then <b>Add to Home Screen</b>, and open ResQure from there to turn on SOS alerts.</p>
            <button className="btn primary block" onClick={() => setView("hidden")}>OK</button>
          </>
        ) : view === "done" ? (
          <>
            <h2 id="optin-title">SOS alerts are on</h2>
            <p>If someone within 3 km sends an SOS, your phone will alert you. Thank you for helping.</p>
          </>
        ) : (
          <>
            <h2 id="optin-title">Turn on SOS alerts</h2>
            <p>When someone near you (within 3 km) is in danger and taps SOS, you get an urgent alert with directions. We also need your location to know who is nearby. It is never shown to anyone.</p>
            <button className="btn primary block" onClick={turnOn} disabled={view === "busy"}>
              <Icon name="bell" className="ic sm" />{view === "busy" ? "Turning on…" : "Turn on alerts"}
            </button>
            <button className="btn text block" onClick={() => setView("hidden")}>Not now</button>
          </>
        )}
        {view !== "done" ? sosLink : null}
      </div>
    </div>
  );
}
