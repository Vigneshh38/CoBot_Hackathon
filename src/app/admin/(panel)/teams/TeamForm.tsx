"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Map as MapLibre, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { saveTeamAction, type TeamFormState } from "../../actions";
import { TEAM_KINDS, type TeamKind } from "@/lib/dispatch";
import { Icon } from "@/components/Icon";

const KEY = process.env.NEXT_PUBLIC_CARTO_KEY;
const STYLE = KEY
  ? `https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json?key=${encodeURIComponent(KEY)}`
  : "https://tiles.openfreemap.org/styles/liberty";
const CHENNAI = { lat: 13.0418, lng: 80.2341 };

export interface TeamValues { id?: number; name: string; kind: TeamKind; area: string; lat: number | null; lng: number | null; phone: string }

/** Click the map (or drag the pin) to set where the team is now. */
function LocationPicker({ value, onChange }: { value: { lat: number; lng: number } | null; onChange: (v: { lat: number; lng: number }) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const marker = useRef<Marker | null>(null);
  const start = useRef(value);
  const cb = useRef(onChange);
  useEffect(() => { cb.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!ref.current) return;
    const c = start.current ?? CHENNAI;
    const map = new MapLibre({ container: ref.current, style: STYLE, center: [c.lng, c.lat], zoom: start.current ? 13 : 11, attributionControl: { compact: true } });
    map.addControl(new NavigationControl({ showCompass: false }), "top-left");
    const place = (lat: number, lng: number) => {
      if (!marker.current) {
        marker.current = new Marker({ draggable: true, color: "#a8865c" }).setLngLat([lng, lat]).addTo(map);
        marker.current.on("dragend", () => { const p = marker.current!.getLngLat(); cb.current({ lat: p.lat, lng: p.lng }); });
      } else marker.current.setLngLat([lng, lat]);
    };
    if (start.current) place(start.current.lat, start.current.lng);
    map.on("click", (e) => { place(e.lngLat.lat, e.lngLat.lng); cb.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }); });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(ref.current);
    return () => { ro.disconnect(); map.remove(); marker.current = null; };
  }, []);

  return <div ref={ref} className="team-picker" aria-label="Click the map to set the team location" />;
}

export function TeamForm({ initial, onDone }: { initial?: TeamValues; onDone?: () => void }) {
  const [state, action, pending] = useActionState<TeamFormState, FormData>(saveTeamAction, {});
  const [loc, setLoc] = useState(initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng } : null);
  const editing = initial?.id != null;

  // Saved: close the form (the page re-renders with the new list).
  useEffect(() => { if (state.ok) onDone?.(); }, [state.ok, onDone]);

  return (
    <form action={action} className="form team-form">
      {editing ? <input type="hidden" name="id" value={initial!.id} /> : null}
      <div className="row2">
        <div className="field"><label>Team name / ID</label>
          <input name="name" className="input" defaultValue={initial?.name} placeholder="e.g. Ambulance A-30" required maxLength={60} /></div>
        <div className="field"><label>Response category</label>
          <select name="kind" className="input" defaultValue={initial?.kind ?? "medical"}>
            {Object.entries(TEAM_KINDS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select></div>
        <div className="field"><label>Base area</label>
          <input name="area" className="input" defaultValue={initial?.area} placeholder="e.g. Tambaram" required maxLength={60} /></div>
        <div className="field"><label>Phone</label>
          <input name="phone" className="input" defaultValue={initial?.phone} placeholder="108" required maxLength={20} /></div>
      </div>
      <div className="field">
        <label>Current location <span className="muted">— click the map or drag the pin</span></label>
        <LocationPicker value={loc} onChange={setLoc} />
        <input type="hidden" name="lat" value={loc?.lat ?? ""} />
        <input type="hidden" name="lng" value={loc?.lng ?? ""} />
        <span className="muted" style={{ fontSize: 12 }}>{loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : "Not set yet"}</span>
      </div>
      {state.error ? <div className="err" role="alert">{state.error}</div> : null}
      <div className="acts">
        {onDone ? <button type="button" className="btn text" onClick={onDone}>Cancel</button> : null}
        <button className="btn primary" disabled={pending}><Icon name="check" className="ic sm" />{pending ? "Saving…" : editing ? "Save changes" : "Add team"}</button>
      </div>
    </form>
  );
}

/** Dialog shell with a title, a close (×) button, and Esc / backdrop click to close. */
function TeamDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <div className="dialog wide" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-h">
          <button type="button" className="dialog-x" onClick={onClose} aria-label="Back" title="Back (Esc)"><Icon name="arrowLeft" className="ic sm" /></button>
          <h3>{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

/** "Add team" button that opens the form in a dialog. */
export function AddTeam() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" className="btn primary" onClick={() => setOpen(true)}><Icon name="plus" className="ic sm" />Add team</button>
      {open ? <TeamDialog title="New response team" onClose={close}><TeamForm onDone={close} /></TeamDialog> : null}
    </>
  );
}

/** "Edit" button on a team row that opens the form in a dialog. */
export function EditTeam({ team }: { team: TeamValues & { id: number } }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" className="btn text sm" onClick={() => setOpen(true)}><Icon name="edit" className="ic sm" />Edit</button>
      {open ? <TeamDialog title={`Edit ${team.name}`} onClose={close}><TeamForm initial={team} onDone={close} /></TeamDialog> : null}
    </>
  );
}
