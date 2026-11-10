"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "@/components/Icon";
import { CallButton } from "@/components/CallButton";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteTeamAction, deleteTeamsAction } from "../../actions";
import { TEAM_KINDS, type TeamKind } from "@/lib/dispatch";
import { severityLabel, statusLabel } from "@/lib/constants";
import type { Team } from "@/lib/incidents";
import { EditTeam } from "./TeamForm";
import { TrackLink } from "./TrackLink";

const KIND_ICON: Record<TeamKind, string> = { fire: "fire", medical: "medical", police: "shield", rescue: "people", flood: "flood" };
type Filter = "all" | "busy" | "free";

function BulkConfirm({ n }: { n: number }) {
  const { pending } = useFormStatus();
  return <button className="btn danger" disabled={pending}><Icon name="trash" className="ic sm" />{pending ? "Deleting…" : `Delete ${n}`}</button>;
}

/** All teams in one box: a row per team, checkboxes for bulk delete, and a filter. */
export function TeamTable({ teams }: { teams: Team[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [kind, setKind] = useState<"" | TeamKind>("");
  const [area, setArea] = useState("");
  const [q, setQ] = useState("");
  const areas = useMemo(() => [...new Set(teams.map((t) => t.area))].sort(), [teams]);
  const kinds = useMemo(() => (Object.keys(TEAM_KINDS) as TeamKind[]).filter((k) => teams.some((t) => t.kind === k)), [teams]);
  const matches = (t: Team) => (!kind || t.kind === kind) && (!area || t.area === area)
    && (!q || `${t.name} ${t.area} ${TEAM_KINDS[t.kind]} ${t.phone}`.toLowerCase().includes(q.trim().toLowerCase()));
  const filtersOn = Boolean(kind || area || q);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState(false);

  const rows = teams.filter((t) => matches(t) && (filter === "all" || (filter === "busy") === (t.busyWith != null)));
  // Only free teams can be deleted, so only they can be ticked.
  const selectable = rows.filter((t) => t.busyWith == null);
  const chosen = teams.filter((t) => picked.has(t.id) && t.busyWith == null);
  const allOn = selectable.length > 0 && selectable.every((t) => picked.has(t.id));

  const toggle = (id: number) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setPicked((p) => {
    const n = new Set(p);
    selectable.forEach((t) => (allOn ? n.delete(t.id) : n.add(t.id)));
    return n;
  });
  const count = (f: Filter) => teams.filter((t) => matches(t) && (f === "all" || (f === "busy") === (t.busyWith != null))).length;

  return (
    <section className="card team-table">
      <div className="card-h">
        <div className="seg" role="tablist" aria-label="Filter teams">
          {(["all", "busy", "free"] as Filter[]).map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "busy" ? "On duty" : "Available"} <span className="muted">{count(f)}</span>
            </button>
          ))}
        </div>
        <div className="tt-filters">
          <label className="tt-search">
            <Icon name="search" className="ic sm" />
            <input className="input" type="search" placeholder="Search name, area, phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search teams" />
          </label>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as "" | TeamKind)} aria-label="Service type">
            <option value="">All service types</option>
            {kinds.map((k) => <option key={k} value={k}>{TEAM_KINDS[k]}</option>)}
          </select>
          <select className="input" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area">
            <option value="">All areas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {filtersOn ? <button type="button" className="btn text sm" onClick={() => { setKind(""); setArea(""); setQ(""); }}>Reset</button> : null}
        </div>
        <span className="grow" />
        {chosen.length ? (
          <>
            <span className="muted">{chosen.length} selected</span>
            <button type="button" className="btn text sm" onClick={() => setPicked(new Set())}>Clear</button>
            <button type="button" className="btn danger sm" onClick={() => setConfirm(true)}><Icon name="trash" className="ic sm" />Delete selected</button>
          </>
        ) : null}
      </div>

      <div className="tt-head" role="row">
        <label className="tt-check" title={selectable.length ? "Select all available teams" : "No available teams to select"}>
          <input type="checkbox" checked={allOn} disabled={!selectable.length} onChange={toggleAll} aria-label="Select all available teams" />
        </label>
        <span>Team</span><span>Status</span><span>Current job</span><span className="tt-acts-h">Actions</span>
      </div>

      {rows.length === 0 ? <div className="empty">{filtersOn ? "No teams match these filters." : "No teams here."}</div> : rows.map((t) => {
        const busy = t.busyWith != null;
        return (
          <div key={t.id} className={`tt-row ${picked.has(t.id) && !busy ? "picked" : ""}`} role="row">
            <label className="tt-check" title={busy ? "On duty teams can't be deleted" : `Select ${t.name}`}>
              <input type="checkbox" checked={picked.has(t.id) && !busy} disabled={busy} onChange={() => toggle(t.id)} aria-label={`Select ${t.name}`} />
            </label>
            <span className="tt-team">
              <span className="team-ic"><Icon name={KIND_ICON[t.kind]} /></span>
              <span><b>{t.name}</b><span className="muted">{TEAM_KINDS[t.kind]} · {t.area}</span></span>
            </span>
            <span><span className={`avail ${busy ? "busy" : "free"}`}>{busy ? <><span className="work-dot" />On duty</> : "Available"}</span></span>
            <span className="tt-job">
              {busy ? (
                <Link href={`/admin/incidents/${t.busyWith}`} className={`sev-${t.jobSeverity}`}>
                  <b>#{t.busyWith} {t.jobTitle}</b>
                  <span className="inc-meta">
                    <span className="tag sev">{severityLabel(t.jobSeverity ?? "low")}</span>
                    <span className={`status st-${t.jobStatus}`}><i />{statusLabel(t.jobStatus ?? "")}</span>
                  </span>
                </Link>
              ) : <span className="muted">Ready for the next assignment</span>}
            </span>
            <span className="tt-acts">
              <TrackLink id={t.id} name={t.name} token={t.track_token} liveAt={t.live_at} />
              <CallButton phone={t.phone} who={`${TEAM_KINDS[t.kind]} (${t.phone})`} label={t.phone} />
              <EditTeam team={{ id: t.id, name: t.name, kind: t.kind, area: t.area, lat: t.lat, lng: t.lng, phone: t.phone }} />
              {busy ? <span className="tt-del-gap" aria-hidden="true" /> : <DeleteButton id={t.id} title={t.name} action={deleteTeamAction} label="" heading="Delete this team?" message="Its past incidents stay in the log." block={false} />}
            </span>
          </div>
        );
      })}

      {confirm ? (
        <div className="dialog-backdrop" onClick={() => setConfirm(false)} role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="bulk-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="bulk-title">Delete {chosen.length} team{chosen.length === 1 ? "" : "s"}?</h3>
            <p>{chosen.map((t) => t.name).join(", ")} will be permanently removed. Their past incidents stay in the log.</p>
            <form action={deleteTeamsAction} className="acts" onSubmit={() => setPicked(new Set())}>
              {chosen.map((t) => <input key={t.id} type="hidden" name="ids" value={t.id} />)}
              <button type="button" className="btn text" onClick={() => setConfirm(false)} autoFocus>Cancel</button>
              <BulkConfirm n={chosen.length} />
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
