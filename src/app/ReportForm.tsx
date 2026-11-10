"use client";

import { useActionState, useState } from "react";
import { submitReport, type ReportState } from "./actions";
import { CATEGORIES } from "@/lib/constants";
import { Icon } from "@/components/Icon";
import { VoiceInput } from "@/components/VoiceInput";

const QUICK = [1, 2, 5, 10, 20, 50];

export function ReportForm() {
  const [state, action, pending] = useActionState<ReportState, FormData>(submitReport, {});
  const [people, setPeople] = useState(1);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [gps, setGps] = useState<"idle" | "locating" | "address" | "error" | "noaddress">("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const e = state.errors ?? {};
  const v = state.values ?? {};

  // GPS -> street address (coordinates are kept hidden and stored for the admin map).
  function useMyLocation() {
    if (!navigator.geolocation) return setGps("error");
    setGps("locating");
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) };
        setCoords(c);
        setGps("address");
        try {
          const res = await fetch(`/api/geocode?lat=${c.lat}&lng=${c.lng}`);
          const data = (await res.json()) as { address?: string };
          if (!res.ok || !data.address) throw new Error();
          setLocation(data.address);
          setGps("idle");
        } catch {
          setLocation((l) => l || "Current location (GPS)");
          setGps("noaddress");
        }
      },
      () => setGps("error"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  const gpsBusy = gps === "locating" || gps === "address";

  const bump = (d: number) => setPeople((n) => Math.max(1, Math.min(100000, n + d)));

  return (
    <form action={action} className="form" noValidate key={state.message ? JSON.stringify(v) : "new"}>
      {state.message ? <div className="err" role="alert">{state.message}</div> : null}

      <div className="field">
        <span className="label" id="cat-label">Emergency category</span>
        <div className="cat-grid" role="radiogroup" aria-labelledby="cat-label">
          {CATEGORIES.map((c) => (
            <label key={c.id} className="cat">
              <input type="radio" name="category" value={c.id} required defaultChecked={v.category === c.id} />
              <span className="cat-card">
                {/* eslint-disable-next-line @next/next/no-img-element -- small static photos */}
                <img src={`/categories/${c.id}.jpg`} alt="" loading="eager" />
                <span className="cat-label"><Icon name={c.id} className="ic sm" />{c.label.replace(" Emergency", "")}</span>
              </span>
            </label>
          ))}
        </div>
        {e.category ? <div className="err">{e.category}</div> : null}
        <a className="hint" href="/categories/CREDITS.md" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block" }}>Photo credits</a>
      </div>

      <div className="field">
        <div className="label-row">
          <label htmlFor="description">What happened?</label>
          <VoiceInput onText={(t) => setDescription((d) => (d ? `${d.trimEnd()} ${t}` : t).slice(0, 2000))} />
        </div>
        <textarea id="description" name="description" className="input" required maxLength={2000} value={description}
          onChange={(ev) => setDescription(ev.target.value)}
          placeholder="Type or tap Speak — e.g. Car hit a lorry near the toll gate, driver is trapped and bleeding"
          aria-invalid={!!e.description} />
        {e.description ? <div className="err">{e.description}</div> : null}
      </div>

      <div className="field">
        <label htmlFor="title">Title <span className="opt">(optional)</span></label>
        <input id="title" name="title" className="input" maxLength={120} defaultValue={v.title} placeholder="Short headline — we'll create one if empty" />
      </div>

      <div className="field">
        <label htmlFor="location">Location</label>
        <div className="input-wrap">
          <input id="location" name="location" className="input" required maxLength={300} value={location}
            onChange={(ev) => setLocation(ev.target.value)} placeholder="Street, landmark or area" aria-invalid={!!e.location} />
          <button type="button" className="btn tonal" onClick={useMyLocation} disabled={gpsBusy}>
            <Icon name="gps" className="ic sm" />{gps === "locating" ? "Locating…" : gps === "address" ? "Finding address…" : "Use GPS"}
          </button>
        </div>
        <input type="hidden" name="lat" value={coords?.lat ?? ""} />
        <input type="hidden" name="lng" value={coords?.lng ?? ""} />
        {coords && gps === "idle" ? <div className="hint">Address found from GPS (accuracy ±{coords.acc} m). Add a landmark if you can.</div> : null}
        {gps === "noaddress" ? <div className="hint">GPS captured, but we couldn&apos;t find the street name — please add a landmark.</div> : null}
        {gps === "error" ? <div className="hint">Couldn&apos;t get GPS — please type the location.</div> : null}
        {e.location ? <div className="err">{e.location}</div> : null}
      </div>

      <div className="field">
        <span className="label">Number of people affected</span>
        <div className="counter">
          <div className="stepper">
            <button type="button" onClick={() => bump(-1)} aria-label="Decrease"><Icon name="minus" /></button>
            <input name="peopleAffected" type="number" inputMode="numeric" min={1} value={people} aria-label="People affected"
              onChange={(ev) => setPeople(Math.max(1, Number(ev.target.value) || 1))} />
            <button type="button" onClick={() => bump(1)} aria-label="Increase"><Icon name="plus" /></button>
          </div>
          {QUICK.map((q) => (
            <button key={q} type="button" className={`quick ${people === q ? "on" : ""}`} onClick={() => setPeople(q)}>
              {q === 50 ? "50+" : q}
            </button>
          ))}
        </div>
        {e.peopleAffected ? <div className="err">{e.peopleAffected}</div> : null}
      </div>

      <div className="field">
        <span className="label">Photo <span className="opt">(optional — helps AI assess severity)</span></span>
        <label className="drop">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not optimisable */}
          {preview ? <img src={preview} alt="Selected photo preview" /> : <Icon name="photo" className="ic lg" />}
          <span><b>{preview ? "Change photo" : "Add a photo"}</b><br /><span className="muted">JPG, PNG or WEBP, up to 5 MB</span></span>
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" capture="environment"
            onChange={(ev) => { const f = ev.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : null); }} />
        </label>
        {e.photo ? <div className="err">{e.photo}</div> : null}
      </div>

      <div className="section-title">Contact</div>
      <div className="row2">
        <div className="field">
          <label htmlFor="contactName">Your name <span className="opt">(optional)</span></label>
          <input id="contactName" name="contactName" className="input" autoComplete="name" maxLength={80} defaultValue={v.contactName} />
        </div>
        <div className="field">
          <label htmlFor="contactPhone">Phone <span className="req">*</span></label>
          <input id="contactPhone" name="contactPhone" className="input" type="tel" autoComplete="tel" maxLength={20} required defaultValue={v.contactPhone}
            placeholder="+91 98xxx xxxxx" aria-invalid={!!e.contactPhone} />
          {e.contactPhone ? <div className="err">{e.contactPhone}</div> : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor="contactEmail">Email <span className="opt">(optional — get updates when your report is handled and resolved)</span></label>
        <input id="contactEmail" name="contactEmail" className="input" type="email" autoComplete="email" maxLength={120}
          placeholder="you@example.com" defaultValue={v.contactEmail} aria-invalid={!!e.contactEmail} />
        {e.contactEmail ? <div className="err">{e.contactEmail}</div> : null}
      </div>

      <p className="notice"><Icon name="shield" className="ic sm" />Your contact details are only visible to emergency administrators.</p>

      <button className="btn primary block" disabled={pending}>
        <Icon name="send" className="ic sm" />{pending ? "Sending report…" : "Submit emergency report"}
      </button>
    </form>
  );
}
