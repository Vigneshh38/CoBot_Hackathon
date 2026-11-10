"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { pushSupport, syncPush } from "@/lib/device";
import { sirenOn, startSiren, stopSiren } from "@/lib/siren";

interface Sos { id: number; code: string; title: string; location: string; created_at: string }

const POLL_MS = 5000;
const noop = () => () => {};
const readPerm = (): NotificationPermission | "unsupported" => (pushSupport() === "ok" ? Notification.permission : "unsupported");

/**
 * Control-room alarm: checks for new SOS every 5 s while the admin panel is open, rings the siren,
 * shows a red banner and a browser notification. "Turn on SOS alerts" also subscribes this device to push,
 * so the admin is alerted even when the panel tab is closed.
 */
export function AdminSosAlarm() {
  const router = useRouter();
  const [list, setList] = useState<Sos[]>([]);
  const [silenced, setSilenced] = useState<Set<number>>(new Set());
  const [sirenBlocked, setSirenBlocked] = useState(false);
  const startPerm = useSyncExternalStore(noop, readPerm, () => "unsupported" as const);
  const [askedPerm, setAskedPerm] = useState<NotificationPermission | null>(null);
  const perm = askedPerm ?? startPerm;
  const notified = useRef(new Set<number>());

  useEffect(() => {
    if (readPerm() === "granted") void syncPush("admin");
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/admin/sos", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const { sos } = (await res.json()) as { sos: Sos[] };
        setList(sos);
        const fresh = sos.filter((s) => !notified.current.has(s.id));
        if (fresh.length) {
          router.refresh(); // pull the new SOS into the queue
          for (const s of fresh) {
            notified.current.add(s.id);
            if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
              new Notification("SOS received: Critical", { body: s.location, tag: `sos-${s.code}`, requireInteraction: true });
            }
          }
        }
      } catch { /* offline: try again next tick */ }
    };
    void tick();
    const t = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [router]);

  const active = list.filter((s) => !silenced.has(s.id));

  const ring = () => startSiren().then((ok) => setSirenBlocked(!ok));
  useEffect(() => {
    if (!active.length) stopSiren();
    else if (!sirenOn()) void ring();
  }, [active.length]);

  useEffect(() => () => stopSiren(), []);

  async function enable() {
    const p = await Notification.requestPermission();
    setAskedPerm(p);
    if (p === "granted") await syncPush("admin");
  }

  function silence() {
    setSilenced(new Set(list.map((s) => s.id)));
    stopSiren();
  }

  return (
    <>
      {active.length ? (
        <div className="admin-sos" role="alert">
          <Icon name="warn" className="ic" />
          <div className="grow">
            <b>{active.length === 1 ? "SOS received" : `${active.length} SOS received`}</b>
            {active.slice(0, 3).map((s) => (
              <Link key={s.id} href={`/admin/incidents/${s.id}`} onClick={() => setSilenced((x) => new Set(x).add(s.id))}>
                {s.location} <Icon name="arrow" className="ic sm" />
              </Link>
            ))}
          </div>
          {sirenBlocked
            ? <button className="btn sm sos-white" onClick={() => void ring()}><Icon name="volume" className="ic sm" />Sound</button>
            : null}
          <button className="btn sm sos-white" onClick={silence}><Icon name="mute" className="ic sm" />Silence</button>
        </div>
      ) : null}
      {perm === "default" ? (
        <button className="admin-push-pill" onClick={enable}><Icon name="bell" className="ic sm" />Turn on SOS alerts for this device</button>
      ) : null}
    </>
  );
}
