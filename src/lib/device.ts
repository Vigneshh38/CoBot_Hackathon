"use client";

/**
 * Things saved on this phone only (localStorage): a random device id, the person's name/phone and
 * up to 3 family numbers for SOS. Every access is wrapped: private mode or blocked storage must never break SOS.
 */
export interface Profile { name: string; phone: string; family: string[] }

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

let memId: string | null = null;
export function getDeviceId(): string {
  const saved = read("resqure.device");
  if (saved) return saved;
  memId ??= crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  write("resqure.device", memId);
  return memId;
}

export function loadProfile(): Profile {
  try {
    const p = JSON.parse(read("resqure.profile") ?? "{}") as Partial<Profile>;
    return { name: p.name ?? "", phone: p.phone ?? "", family: Array.isArray(p.family) ? p.family.slice(0, 3) : [] };
  } catch {
    return { name: "", phone: "", family: [] };
  }
}

export function saveProfile(p: Partial<Profile>) {
  write("resqure.profile", JSON.stringify({ ...loadProfile(), ...p }));
}

const tryPosition = (opts: PositionOptions) =>
  new Promise<{ pos: GeolocationPosition | null; denied: boolean }>((resolve) => {
    if (!navigator.geolocation) return resolve({ pos: null, denied: false });
    navigator.geolocation.getCurrentPosition((pos) => resolve({ pos, denied: false }),
      (err) => resolve({ pos: null, denied: err.code === err.PERMISSION_DENIED }), opts);
  });

/**
 * Current position, or null if denied / unavailable. Tries precise GPS first; indoors GPS often times out,
 * so it then falls back to a quick network (Wi-Fi / cell) fix, which is plenty for "within 3 km".
 */
export async function getPosition(timeoutMs = 8000): Promise<GeolocationPosition | null> {
  const precise = await tryPosition({ enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 });
  if (precise.pos || precise.denied) return precise.pos;
  return (await tryPosition({ enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 })).pos;
}

/** Has the user already allowed location? (Checking never shows a prompt.) */
export async function locationAllowed(): Promise<boolean> {
  try {
    return (await navigator.permissions.query({ name: "geolocation" })).state === "granted";
  } catch {
    return false;
  }
}

export type PushSupport = "ok" | "unsupported" | "ios-install"; // ios-install: iPhone needs "Add to Home Screen" first

export function pushSupport(): PushSupport {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
  if (ios && !standalone) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return "ok";
}

function urlBase64ToUint8Array(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Register the service worker, subscribe to push and send the subscription (+ location if given) to the server.
 * Call only after Notification permission is granted.
 */
export async function syncPush(role: "citizen" | "admin", pos?: GeolocationPosition | null): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { key } = (await (await fetch("/api/push/key")).json()) as { key: string };
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
    }
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: getDeviceId(), role, subscription: sub.toJSON(), lat: pos?.coords.latitude, lng: pos?.coords.longitude }),
    });
    return res.ok;
  } catch (e) {
    console.warn("[push] subscribe failed", e);
    return false;
  }
}
