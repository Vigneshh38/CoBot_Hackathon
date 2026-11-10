"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { SosDetails } from "./SosButton";

interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

const noop = () => () => {};
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || !!(navigator as unknown as { standalone?: boolean }).standalone;
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

/**
 * Small "Add SOS to phone" button (top right of the citizen page). Installs ResQure as a home-screen app
 * that opens straight on the hold-to-send SOS screen. Uses the browser's install prompt when it offers one,
 * otherwise shows short instructions (iPhone: Share > Add to Home Screen).
 */
export function InstallSos() {
  const standalone = useSyncExternalStore(noop, isStandalone, () => true); // hidden on the server, and inside the installed app
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (standalone) return null;

  async function add() {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      setPrompt(null);
      if (outcome === "accepted") { setInstalled(true); setOpen(true); }
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <button className="install-sos" onClick={add}>
        <span className="install-sos-ic">SOS</span>Add SOS to phone
      </button>

      {open ? (
        <div className="optin-backdrop" onClick={() => setOpen(false)}>
          <div className="optin" role="dialog" aria-modal="true" aria-labelledby="inst-title" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny static app icon */}
            <img className="install-app-ic" src="/app/sos-192.png" alt="" width={56} height={56} />
            {installed ? (
              <>
                <h2 id="inst-title">SOS app added</h2>
                <p>Find the red <b>SOS</b> icon on your home screen. Open it and hold the button for 3 seconds to send an alert.</p>
              </>
            ) : isIos() ? (
              <>
                <h2 id="inst-title">Add SOS to your iPhone</h2>
                <ol className="install-steps">
                  <li>Open the <Link href="/sos">SOS screen</Link>.</li>
                  <li>Tap <b>Share</b> at the bottom of Safari.</li>
                  <li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
                </ol>
              </>
            ) : (
              <>
                <h2 id="inst-title">Add SOS to your phone</h2>
                <ol className="install-steps">
                  <li>Open your browser menu (<b>⋮</b>).</li>
                  <li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li>
                  <li>The red <b>SOS</b> icon opens straight on the SOS button.</li>
                </ol>
              </>
            )}

            <div className="install-tip">
              <b>Open it fast</b>
              <span><b>Samsung:</b> Settings › Advanced features › Side button › Double press › Open app › SOS.</span>
              <span><b>iPhone:</b> Settings › Accessibility › Touch › Back Tap › Double Tap › a Shortcut that opens this site&apos;s /sos page.</span>
              <span>For a 5-press power button call, also turn on your phone&apos;s own <b>Emergency SOS</b> in Settings.</span>
            </div>

            <button className="btn tonal block" onClick={() => setDetails(true)}><Icon name="edit" className="ic sm" />Set my SOS details and family numbers</button>
            <button className="btn text block" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      ) : null}
      {details ? <SosDetails onClose={() => setDetails(false)} /> : null}
    </>
  );
}
