"use client";

/**
 * Loud, high-pitched siren made with the Web Audio API (no audio file).
 * Browsers only allow sound after the user has tapped the page once, so start() returns false when blocked.
 */
let ctx: AudioContext | null = null;
let stopFn: (() => void) | null = null;

/** Vibrate only after the user has tapped the page (browsers block it before that). */
const buzz = (pattern: number | number[]) => {
  const ua = (navigator as unknown as { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (!ua || ua.hasBeenActive) navigator.vibrate?.(pattern);
};

export async function startSiren(): Promise<boolean> {
  if (stopFn) return true;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new AC();
    if (ctx.state === "suspended") await ctx.resume();
    if (ctx.state !== "running") return false;

    const gain = ctx.createGain();
    gain.gain.value = 0.9;
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.connect(gain);
    // Wail between 900 Hz and 1800 Hz, twice a second.
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 2;
    depth.gain.value = 450;
    osc.frequency.value = 1350;
    lfo.connect(depth).connect(osc.frequency);
    osc.start();
    lfo.start();

    const timer = setInterval(() => buzz([500, 150, 500]), 1300);
    buzz([500, 150, 500]);
    stopFn = () => {
      clearInterval(timer);
      buzz(0);
      try { osc.stop(); lfo.stop(); } catch { /* already stopped */ }
      gain.disconnect();
      stopFn = null;
    };
    return true;
  } catch {
    return false;
  }
}

export function stopSiren() {
  stopFn?.();
}

export const sirenOn = () => stopFn != null;
