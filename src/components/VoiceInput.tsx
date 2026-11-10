"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

// Minimal typing for the browser Web Speech API (Chrome, Edge, Android, Safari).
interface SpeechResultEvent { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }
interface Recognizer {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type RecognizerCtor = new () => Recognizer;

function getRecognizer(): RecognizerCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Mic button: speaks into the text field. Hidden on browsers without speech support. */
export function VoiceInput({ onText, lang = "en-IN" }: { onText: (text: string) => void; lang?: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognizer | null>(null);

  useEffect(() => {
    // Feature detection must run on the client after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(!!getRecognizer());
    return () => rec.current?.stop();
  }, []);

  function toggle() {
    if (listening) { rec.current?.stop(); return; }
    const Ctor = getRecognizer();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = lang; r.continuous = true; r.interimResults = false;
    r.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript;
      if (text.trim()) onText(text.trim());
    };
    r.onerror = (e) => setError(e.error === "not-allowed" ? "Microphone permission was blocked." : "Couldn't hear that — try again.");
    r.onend = () => setListening(false);
    rec.current = r;
    setError(null);
    setListening(true);
    r.start();
  }

  if (!supported) return null;
  return (
    <>
      <button type="button" className={`btn ${listening ? "danger" : "tonal"} sm voice-btn`} onClick={toggle} aria-pressed={listening}>
        {listening ? <span className="pulse-dot" /> : <Icon name="mic" className="ic sm" />}
        {listening ? "Listening… tap to stop" : "Speak"}
      </button>
      {error ? <div className="hint" role="status">{error}</div> : null}
    </>
  );
}
