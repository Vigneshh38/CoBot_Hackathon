"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GeoJSONSource, LngLatBounds, Map as MapLibre, Marker, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Icon } from "./Icon";
import { CallButton } from "./CallButton";
import type { RouteInfo } from "@/lib/route";
import { agoText, hasArrived, liveState, needsReroute } from "@/lib/tracking";

/** Latest position reported by a vehicle (from /api/live). */
interface LivePos { id: number; lat: number; lng: number; accuracy: number | null; speed: number | null; heading: number | null; at: string }
const LIVE_POLL_MS = 5000;
import { SERVICE_LABELS, type Service, type ServiceKind } from "@/lib/services";

// Government services layer: colour + icon per kind (colours pass the colourblind check; the icon carries identity too).
const SERVICE_KINDS = ["fire", "police", "hospital"] as const satisfies readonly ServiceKind[];
const SERVICE_COLOR: Record<string, string> = { fire: "#c0562b", police: "#3b5ba5", hospital: "#138a6e", ambulance: "#138a6e" };
const SERVICE_SVG: Record<string, string> = {
  fire: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.6.2 1.8 1 2.8 2 3.2C11 9 11 6 12 3z"/>',
  police: '<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"/>',
  hospital: '<path d="M12 6v12M6 12h12"/>',
  ambulance: '<path d="M12 6v12M6 12h12"/>',
};
const SERVICE_PLURAL: Record<string, string> = { fire: "Fire stations", police: "Police stations", hospital: "Govt hospitals" };

/** Popup body built with DOM text nodes (OSM names are untrusted, so never innerHTML). */
function servicePopup(s: Service): HTMLElement {
  const box = document.createElement("div");
  box.className = "svc-pop";
  const kind = document.createElement("span"); kind.className = "svc-kind"; kind.textContent = SERVICE_LABELS[s.kind];
  kind.style.color = SERVICE_COLOR[s.kind];
  const name = document.createElement("b"); name.textContent = s.name;
  box.append(kind, name);
  const links = document.createElement("div"); links.className = "svc-links";
  if (s.phone) { const a = document.createElement("a"); a.href = `tel:${s.phone.replace(/[^\d+]/g, "")}`; a.textContent = `Call ${s.phone}`; links.append(a); }
  const nav = document.createElement("a");
  nav.href = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`; nav.target = "_blank"; nav.rel = "noopener noreferrer"; nav.textContent = "Directions";
  links.append(nav);
  box.append(links);
  return box;
}

// OpenFreeMap "liberty": free, no key, and includes 3D building extrusions.
const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const SEV_COLOR: Record<string, string> = { critical: "#b3261e", high: "#b4581c", medium: "#8a7214", low: "#4f7a5a" };

// Inline copies of our icon paths for DOM markers (MapLibre markers are plain DOM, not React).
const KIND_SVG: Record<string, string> = {
  medical: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M12 8v8M8 12h8"/>',
  fire: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.6.2 1.8 1 2.8 2 3.2C11 9 11 6 12 3z"/>',
  police: '<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
  rescue: '<circle cx="8" cy="9" r="2.5"/><circle cx="16" cy="9" r="2.5"/><path d="M3.5 18c.5-2.5 2.3-4 4.5-4s4 1.5 4.5 4M11.5 18c.5-2.5 2.3-4 4.5-4s4 1.5 4.5 4"/>',
  flood: '<path d="M3 9c2 0 2-1.5 4.5-1.5S9.5 9 12 9s2.5-1.5 4.5-1.5S19 9 21 9M3 15c2 0 2-1.5 4.5-1.5S9.5 15 12 15s2.5-1.5 4.5-1.5S19 15 21 15"/>',
};
const svg = (kind: string) => `<svg viewBox="0 0 24 24" class="ic sm" aria-hidden="true">${KIND_SVG[kind] ?? KIND_SVG.rescue}</svg>`;

export interface MapIncident {
  id: number; title: string; category: string; categoryLabel: string; severity: string; severityLabel: string;
  status: string; statusLabel: string; location: string; lat: number; lng: number; people: number; createdAt: string;
  summary: string; teamId: number | null; assignedAt: string | null;
}
export interface MapTeam { id: number; name: string; kind: string; kindLabel: string; area: string; phone: string; lat: number; lng: number; busyWith: number | null }

function fmtMin(s: number) {
  const m = Math.ceil(s / 60);
  return m <= 1 ? "under a minute" : `${m} min`;
}

export function MapConsole({ incidents, teams, services = [] }: { incidents: MapIncident[]; teams: MapTeam[]; services?: Service[] }) {
  const box = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const incMarkers = useRef<Marker[]>([]);
  const teamMarkers = useRef<Marker[]>([]);
  const svcMarkers = useRef<Marker[]>([]);
  const [legendOpen, setLegendOpen] = useState(true);
  const [svcShown, setSvcShown] = useState<Record<string, boolean>>({ fire: true, police: true, hospital: true });
  const movers = useRef(new Map<number, { marker: Marker; el: HTMLElement }>());
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [showTeams, setShowTeams] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [is3d, setIs3d] = useState(true);
  const [routes, setRoutes] = useState<Record<number, RouteInfo & { from: { lat: number; lng: number } }>>({});
  const [live, setLive] = useState<Record<number, LivePos>>({});
  const [now, setNow] = useState(() => Date.now());

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  /** Where a vehicle really is: its last GPS fix, unless that is over 10 min old (then unknown). */
  const posOf = useCallback((teamId: number) => {
    const l = live[teamId];
    return l && liveState(l.at, now) !== "offline" ? l : null;
  }, [live, now]);

  // Poll the vehicles' reported positions (sent by their phones / GPS units to /api/track).
  useEffect(() => {
    let stop = false;
    const load = () => fetch("/api/live", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null))
      .then((d: { positions: LivePos[] } | null) => { if (d && !stop) setLive(Object.fromEntries(d.positions.map((p) => [p.id, p]))); })
      .catch(() => {});
    load();
    const t = setInterval(load, LIVE_POLL_MS);
    return () => { stop = true; clearInterval(t); };
  }, []);
  // Incidents with a team on the way (or on scene) — these get a route and a moving unit.
  const enRoute = useMemo(
    () => incidents.filter((i) => i.teamId != null && i.assignedAt && (i.status === "assigned" || i.status === "in_progress") && teamById.has(i.teamId)),
    [incidents, teamById],
  );

  const fitAll = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const b = new LngLatBounds();
    incidents.forEach((i) => b.extend([i.lng, i.lat]));
    if (showTeams) teams.forEach((t) => b.extend([t.lng, t.lat]));
    if (!b.isEmpty()) m.fitBounds(b, { padding: { top: 60, bottom: 60, left: selected ? 420 : 60, right: 90 }, maxZoom: 15, duration: 600 });
  }, [incidents, teams, showTeams, selected]);

  // Map setup
  useEffect(() => {
    if (!box.current) return;
    const m = new MapLibre({ container: box.current, style: STYLE, center: [80.24, 13.05], zoom: 12, pitch: 55, bearing: -17, maxPitch: 70, attributionControl: { compact: true } });
    m.on("load", () => {
      m.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "routes-casing", type: "line", source: "routes", paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.9 }, layout: { "line-cap": "round", "line-join": "round" } });
      m.addLayer({ id: "routes", type: "line", source: "routes", paint: { "line-color": "#9a7650", "line-width": 4, "line-dasharray": [1.5, 1.2] }, layout: { "line-cap": "round", "line-join": "round" } });
      setReady(true);
    });
    map.current = m;
    // Keep the canvas matched to the container (page layout settles after the map is created).
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(box.current);
    m.once("load", () => m.resize());
    // Collapse team labels when zoomed out so they don't overlap.
    const syncZoom = () => wrap.current?.classList.toggle("far", m.getZoom() < 13);
    m.on("zoom", syncZoom);
    m.once("load", syncZoom);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { ro.disconnect(); clearInterval(tick); m.remove(); map.current = null; };
  }, []);

  // First fit once data + map are ready
  const fitted = useRef(false);
  useEffect(() => { if (ready && !fitted.current) { fitted.current = true; fitAll(); } }, [ready, fitAll]);

  // Incident pins
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    incMarkers.current.forEach((mk) => mk.remove());
    incMarkers.current = incidents.map((i) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `map-pin ${i.severity === "critical" ? "pulse" : ""} ${selected === i.id ? "sel" : ""}`;
      el.style.background = SEV_COLOR[i.severity] ?? SEV_COLOR.low;
      el.title = `#${i.id} · ${i.title}`;
      el.setAttribute("aria-label", `Open incident ${i.title}`);
      el.addEventListener("click", (e) => { e.stopPropagation(); setSelected(i.id); });
      return new Marker({ element: el }).setLngLat([i.lng, i.lat]).addTo(m);
    });
  }, [incidents, selected]);

  // Government services (fire / police / hospitals from OpenStreetMap), one toggle per kind.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    svcMarkers.current.forEach((mk) => mk.remove());
    svcMarkers.current = services.filter((s) => svcShown[s.kind]).map((s) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "svc-pin";
      el.style.setProperty("--svc", SERVICE_COLOR[s.kind]);
      el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${SERVICE_SVG[s.kind]}</svg>`; // static icon only
      el.title = `${SERVICE_LABELS[s.kind]}: ${s.name}`;
      el.setAttribute("aria-label", `${SERVICE_LABELS[s.kind]}: ${s.name}`);
      const popup = new Popup({ offset: 14, closeButton: false, maxWidth: "260px" }).setDOMContent(servicePopup(s));
      return new Marker({ element: el }).setLngLat([s.lng, s.lat]).setPopup(popup).addTo(m);
    });
  }, [services, svcShown, ready]);

  // Team base markers (working teams are drawn as moving units instead)
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    teamMarkers.current.forEach((mk) => mk.remove());
    if (!showTeams) { teamMarkers.current = []; return; }
    const moving = new Set(enRoute.map((i) => i.teamId));
    teamMarkers.current = teams.filter((t) => !moving.has(t.id)).map((t) => {
      const p = posOf(t.id);
      const el = document.createElement("div");
      el.className = `unit ${t.busyWith != null ? "busy" : ""}`;
      el.innerHTML = `${svg(t.kind)}<span>${t.name}</span>`;
      el.title = `${t.name} · ${t.kindLabel} · ${t.busyWith != null ? "On duty" : "Available"} · ${p ? "live GPS" : "at base (no GPS)"}`;
      return new Marker({ element: el, anchor: "left", offset: [-12, 0] }).setLngLat(p ? [p.lng, p.lat] : [t.lng, t.lat]).addTo(m);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redraw when positions change, not on every clock tick
  }, [teams, showTeams, enRoute, live]);

  // Fetch road routes for units on the way
  useEffect(() => {
    enRoute.forEach((i) => {
      const t = teamById.get(i.teamId!)!;
      // Route from where the vehicle really is (its GPS); from its base until the first fix arrives.
      const from = posOf(t.id) ?? { lat: t.lat, lng: t.lng };
      const have = routes[i.id];
      if (have && !needsReroute(have.from, from)) return;
      if (hasArrived(from, i)) return;
      fetch(`/api/route?from=${from.lng},${from.lat}&to=${i.lng},${i.lat}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((r: RouteInfo | null) => { if (r) setRoutes((old) => ({ ...old, [i.id]: { ...r, from } })); })
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-check only when positions or assignments change
  }, [enRoute, live, teamById]);

  // Draw route lines
  useEffect(() => {
    const src = ready ? (map.current?.getSource("routes") as GeoJSONSource | undefined) : undefined;
    if (!src) return;
    src.setData({
      type: "FeatureCollection",
      features: showRoutes ? enRoute.filter((i) => routes[i.id]).map((i) => ({
        type: "Feature", properties: { id: i.id }, geometry: { type: "LineString", coordinates: routes[i.id].coords },
      })) : [],
    });
  }, [ready, enRoute, routes, showRoutes]);

  // Units on a job: drawn where their own GPS last reported (no simulated movement).
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const shown = new Set<number>();
    enRoute.forEach((i) => {
      const t = teamById.get(i.teamId!)!;
      const p = posOf(t.id);
      const at: [number, number] = p ? [p.lng, p.lat] : [t.lng, t.lat];
      shown.add(i.id);
      let mv = movers.current.get(i.id);
      if (!mv) {
        const el = document.createElement("div");
        el.className = "unit moving";
        el.addEventListener("click", () => setSelected(i.id));
        mv = { el, marker: new Marker({ element: el, anchor: "left", offset: [-12, 0] }).setLngLat(at).addTo(m) };
        movers.current.set(i.id, mv);
      }
      const arrived = p ? hasArrived(p, i) : false;
      const r = routes[i.id];
      const label = !p ? "no GPS yet" : arrived ? "on scene" : liveState(p.at, now) === "stale" ? `GPS ${agoText(p.at, now)}` : r ? fmtMin(r.durationS) : "locating…";
      mv.el.innerHTML = `${svg(t.kind)}<span>${t.name} · ${label}</span>`;
      mv.el.classList.toggle("arrived", arrived);
      mv.el.classList.toggle("nogps", !p);
      mv.marker.setLngLat(at);
    });
    for (const [id, mv] of movers.current) if (!shown.has(id)) { mv.marker.remove(); movers.current.delete(id); }
  }, [enRoute, routes, teamById, posOf, now]);

  // Fly to the selected incident
  useEffect(() => {
    const i = incidents.find((x) => x.id === selected);
    if (i && map.current) map.current.easeTo({ center: [i.lng, i.lat], zoom: Math.max(map.current.getZoom(), 15.5), padding: { left: 400, top: 0, right: 0, bottom: 0 }, duration: 700 });
  }, [selected, incidents]);

  const sel = incidents.find((i) => i.id === selected) ?? null;
  const selTeam = sel?.teamId != null ? teamById.get(sel.teamId) : undefined;
  const selRoute = sel ? routes[sel.id] : undefined;
  const selPos = selTeam ? posOf(selTeam.id) : null;
  const selArrived = sel && selPos ? hasArrived(selPos, sel) : false;

  const toggle3d = () => {
    const next = !is3d;
    setIs3d(next);
    map.current?.easeTo({ pitch: next ? 55 : 0, bearing: next ? -17 : 0, duration: 800 });
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrap.current?.requestFullscreen?.();
  };

  return (
    <div className="mc" ref={wrap}>
      <div ref={box} className="mc-map" />

      {/* Summary chip */}
      {!sel ? (
        <div className="mc-chip card">
          <span className="mc-legend">
            {Object.entries(SEV_COLOR).reverse().map(([k, c]) => <span key={k}><i style={{ background: c }} />{k[0].toUpperCase() + k.slice(1)}</span>)}
          </span>
        </div>
      ) : null}

      {/* Left panel */}
      {sel ? (
        <aside className="mc-panel card" key={sel.id} aria-label="Incident details">
          <div className="mc-panel-h">
            <button className="btn text sm" onClick={() => setSelected(null)}><Icon name="arrowLeft" className="ic sm" />Back</button>
            <span className="grow" />
            <span className="muted" style={{ fontSize: 12 }}>#{sel.id}</span>
          </div>
          <div className={`inc sev-${sel.severity}`} style={{ alignItems: "flex-start" }}>
            <span className="type-ic"><Icon name={sel.category} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="inc-title" style={{ fontSize: 15 }}>{sel.title}</div>
              <div className="inc-meta">
                <span className="tag sev">{sel.severity === "critical" ? <span className="pulse-dot" /> : null}{sel.severityLabel}</span>
                <span className={`status st-${sel.status}`}><i />{sel.statusLabel}</span>
              </div>
            </div>
          </div>

          <section className="mc-sec">
            <h4><Icon name="pin" className="ic sm" />Location</h4>
            <p>{sel.location}</p>
            <p className="muted" style={{ fontSize: 12 }}>{sel.lat.toFixed(5)}, {sel.lng.toFixed(5)}</p>
            <div className="mc-actions">
              <a className="btn tonal sm" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${sel.lat},${sel.lng}`}><Icon name="send" className="ic sm" />Navigate</a>
              <a className="btn tonal sm" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${sel.lat},${sel.lng}`}><Icon name="photo" className="ic sm" />Street view</a>
            </div>
          </section>

          <section className="mc-sec">
            <h4><Icon name="people" className="ic sm" />Assigned team</h4>
            {selTeam ? (
              <div className="mc-unit">
                <div className="mc-unit-top">
                  <span className="team-ic" style={{ width: 34, height: 34 }} dangerouslySetInnerHTML={{ __html: svg(selTeam.kind) }} />
                  <div style={{ minWidth: 0 }}><b>{selTeam.name}</b><div className="muted" style={{ fontSize: 12 }}>{selTeam.kindLabel} · from {selTeam.area}</div></div>
                  <CallButton phone={selTeam.phone} who={`${selTeam.name} via ${selTeam.phone}`} label={selTeam.phone} className="btn text sm" />
                </div>
                {sel.status === "assigned" || sel.status === "in_progress" ? (
                  selPos ? (
                    <>
                      <div className="mc-eta">
                        <span>{selArrived ? "On scene" : selRoute ? `Arriving in ${fmtMin(selRoute.durationS)}` : "Working out the route…"}</span>
                        {!selArrived && selRoute ? <span className="muted">{(selRoute.distanceM / 1000).toFixed(1)} km{selRoute.road ? " by road" : ""}</span> : null}
                      </div>
                      <p className="muted" style={{ fontSize: 11.5, margin: "6px 0 0" }}>
                        <span className={`gps-dot ${liveState(selPos.at, now)}`} />Vehicle GPS {agoText(selPos.at, now)}
                        {selPos.speed != null ? ` · ${Math.round(selPos.speed * 3.6)} km/h` : ""}
                        {selPos.accuracy != null ? ` · ±${Math.round(selPos.accuracy)} m` : ""}
                      </p>
                    </>
                  ) : (
                    <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 0" }}>
                      <span className="gps-dot offline" />Waiting for the vehicle&apos;s GPS. Share the team&apos;s tracking link with the crew (Teams page).
                    </p>
                  )
                ) : null}
              </div>
            ) : (
              <div className="mc-actions">
                <span className="tag warn-tag">No team yet</span>
                <Link className="btn primary sm" href={`/admin/incidents/${sel.id}`}><Icon name="send" className="ic sm" />Assign a team</Link>
              </div>
            )}
          </section>

          <section className="mc-sec">
            <h4><Icon name="list" className="ic sm" />Details</h4>
            <dl className="kv" style={{ gridTemplateColumns: "110px 1fr", fontSize: 13 }}>
              <dt>Category</dt><dd>{sel.categoryLabel}</dd>
              <dt>People affected</dt><dd>{sel.people}</dd>
              <dt>Reported</dt><dd>{new Date(sel.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</dd>
            </dl>
          </section>

          <Link className="btn primary block" href={`/admin/incidents/${sel.id}`}>Open full incident<Icon name="arrow" className="ic sm" /></Link>
        </aside>
      ) : null}

      {!sel ? (
        legendOpen ? (
          <div className="map-legend" role="group" aria-label="Map legend">
            <div className="ml-head"><b>Legend</b><button type="button" className="ml-x" onClick={() => setLegendOpen(false)} aria-label="Hide legend" title="Hide legend"><Icon name="minus" className="ic sm" /></button></div>
            {SERVICE_KINDS.map((k) => (
              <label key={k} className="ml-row" style={{ ["--svc" as string]: SERVICE_COLOR[k] }}>
                <span className="svc-pin sm" aria-hidden="true"><svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: SERVICE_SVG[k] }} /></span>
                <span className="ml-name">{SERVICE_PLURAL[k]} <span className="muted">{services.filter((s) => s.kind === k).length}</span></span>
                <input type="checkbox" className="switch" checked={!!svcShown[k]} onChange={() => setSvcShown((v) => ({ ...v, [k]: !v[k] }))} />
              </label>
            ))}
            <label className="ml-row">
              <span className="ml-ic" aria-hidden="true"><Icon name="people" className="ic sm" /></span>
              <span className="ml-name">Response teams</span>
              <input type="checkbox" className="switch" checked={showTeams} onChange={() => setShowTeams((v) => !v)} />
            </label>
            <label className="ml-row">
              <span className="ml-ic" aria-hidden="true"><Icon name="send" className="ic sm" /></span>
              <span className="ml-name">Team routes</span>
              <input type="checkbox" className="switch" checked={showRoutes} onChange={() => setShowRoutes((v) => !v)} />
            </label>
            <div className="ml-sev">
              {Object.entries(SEV_COLOR).reverse().map(([k, c]) => <span key={k}><i style={{ background: c }} />{k[0].toUpperCase() + k.slice(1)}</span>)}
            </div>
            <span className="svc-src">Govt services © OpenStreetMap</span>
          </div>
        ) : (
          <button type="button" className="ml-open" onClick={() => setLegendOpen(true)} aria-label="Show legend"><Icon name="list" className="ic sm" />Legend</button>
        )
      ) : null}

      {/* Right control bar */}
      <div className="mc-controls" role="toolbar" aria-label="Map controls">
        <button onClick={() => map.current?.zoomIn()} title="Zoom in" aria-label="Zoom in"><Icon name="plus" className="ic sm" /></button>
        <button onClick={() => map.current?.zoomOut()} title="Zoom out" aria-label="Zoom out"><Icon name="minus" className="ic sm" /></button>
        <hr />
        <button onClick={toggle3d} className={is3d ? "on" : ""} title={is3d ? "Switch to 2D" : "Switch to 3D"} aria-pressed={is3d}><b style={{ fontSize: 11.5 }}>{is3d ? "3D" : "2D"}</b></button>
        <button onClick={() => map.current?.resetNorth({ duration: 500 })} title="Reset north" aria-label="Reset north"><Icon name="arrow" className="ic sm" /></button>
        <hr />
        <button onClick={fitAll} title="Show all" aria-label="Show all incidents"><Icon name="gps" className="ic sm" /></button>
        <button onClick={() => setShowTeams((v) => !v)} className={showTeams ? "on" : ""} title="Show teams" aria-pressed={showTeams}><Icon name="people" className="ic sm" /></button>
        <button onClick={() => setShowRoutes((v) => !v)} className={showRoutes ? "on" : ""} title="Show routes" aria-pressed={showRoutes}><Icon name="send" className="ic sm" /></button>
        <hr />
        <button onClick={toggleFullscreen} title="Full screen" aria-label="Full screen"><Icon name="expand" className="ic sm" /></button>
      </div>
    </div>
  );
}
