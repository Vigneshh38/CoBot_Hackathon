import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { DeleteButton } from "@/components/DeleteButton";
import { Icon } from "@/components/Icon";
import { CallButton } from "@/components/CallButton";
import { IncidentMap } from "@/components/IncidentMap";
import { ConfidenceInfo } from "@/components/ConfidenceInfo";
import { requireAdmin } from "@/lib/auth";
import { aiIsStale, getIncident, listTeams, markSeen } from "@/lib/incidents";
import { rankTeams, TEAM_KINDS } from "@/lib/dispatch";
import { SEVERITIES, STATUSES, categoryLabel, severityLabel, statusLabel } from "@/lib/constants";
import { assignTeamAction, removeIncident, retryAi, setSeverity, setStatus, unassignTeamAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const SEV_COLOR = { critical: "#b3261e", high: "#b4581c", medium: "#8a7214", low: "#4f7a5a" } as const;

export default async function IncidentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ assignError?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const inc = /^\d+$/.test(id) ? getIncident(Number(id)) : undefined;
  if (!inc) notFound();
  markSeen(inc.id);
  const { assignError } = await searchParams;
  const ranked = rankTeams(listTeams(), inc);
  const assigned = ranked.find((r) => r.team.id === inc.team_id);
  // Nearest 4 teams (plus the assigned one) for the location map.
  const nearby = ranked.filter((r) => r.km != null).sort((a, b) => a.km! - b.km!)
    .filter((r, i) => i < 4 || r.team.id === inc.team_id)
    .map((r) => ({ id: r.team.id, name: r.team.name, kind: r.team.kind, lat: r.team.lat, lng: r.team.lng, km: r.km!,
      busy: r.team.busyWith != null, recommended: r.recommended, assigned: r.team.id === inc.team_id }));
  const aiStale = aiIsStale(inc);
  const aiBusy = (inc.ai_status === "queued" || inc.ai_status === "running") && !aiStale;
  const canRetry = inc.ai_status === "failed" || ((inc.ai_status === "queued" || inc.ai_status === "running") && aiStale);

  return (
    <>
      {aiBusy ? <AutoRefresh seconds={4} /> : null}
      <main className="page">
        <Link href="/admin" className="back"><Icon name="arrowLeft" className="ic sm" />Back to incidents</Link>
        <div className={`inc sev-${inc.severity}`}>
          <span className="type-ic" style={{ width: 48, height: 48 }}><Icon name={inc.category} className="ic lg" /></span>
          <div>
            <h1>{inc.is_sos ? <span className="sos-badge">SOS</span> : null}{inc.title}</h1>
            <div className="inc-meta">
              <span className="tag sev">{inc.severity === "critical" && inc.status !== "resolved" ? <span className="pulse-dot" /> : null}{severityLabel(inc.severity)}</span>
              <span className={`status st-${inc.status}`}><i />{statusLabel(inc.status)}</span>
              <span>· #{inc.id} · code {inc.code}</span>
            </div>
          </div>
        </div>

        <div className="detail">
          <div className="side-stack">
            <section className="card card-pad">
              <dl className="kv">
                <dt>Category</dt><dd>{categoryLabel(inc.category)}</dd>
                <dt>Description</dt><dd style={{ fontWeight: 400, whiteSpace: "pre-wrap" }}>{inc.description}</dd>
                <dt>Location</dt><dd>{inc.location}</dd>
                <dt>People affected</dt><dd>{inc.people_affected}</dd>
                <dt>Contact</dt>
                <dd>{inc.contact_name || inc.contact_phone ? (
                  <>{inc.contact_name ?? "—"}{inc.contact_phone ? <> · <a href={`tel:${inc.contact_phone.replace(/\s/g, "")}`} style={{ color: "var(--sand-700)" }}>{inc.contact_phone}</a></> : null}</>
                ) : <span className="muted">Not provided</span>}</dd>
                {inc.is_sos ? (<>
                  <dt>SOS alerts</dt>
                  <dd>{inc.alerted_nearby} nearby {inc.alerted_nearby === 1 ? "person" : "people"} alerted · {inc.helpers} going to help
                    {inc.family_phones ? ` · ${(JSON.parse(inc.family_phones) as string[]).length} family SMS` : ""}</dd>
                </>) : null}
                <dt>Reported</dt><dd>{new Date(inc.created_at).toLocaleString("en-IN")}</dd>
                <dt>Last updated</dt><dd>{new Date(inc.updated_at).toLocaleString("en-IN")}</dd>
              </dl>
            </section>

            {inc.lat != null && inc.lng != null ? (
              <section className="card card-pad">
                <div className="card-h" style={{ padding: "0 0 12px" }}><Icon name="pin" /><h2>Location &amp; nearby teams</h2>
                  <span className="grow" />
                  <a className="btn text sm" target="_blank" rel="noopener noreferrer"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${inc.lat},${inc.lng}`}>Directions<Icon name="arrow" className="ic sm" /></a>
                </div>
                <IncidentMap lat={inc.lat} lng={inc.lng} color={SEV_COLOR[inc.severity]} teams={nearby} />
                <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 0" }}>Showing the {nearby.length} nearest response teams. ★ = recommended.</p>
              </section>
            ) : null}

            {inc.photo_file ? (
              <section className="card card-pad">
                <div className="card-h" style={{ padding: "0 0 12px" }}><Icon name="photo" /><h2>Photo from reporter</h2></div>
                {/* eslint-disable-next-line @next/next/no-img-element -- private admin-only route, not optimisable */}
                <img className="photo" src={`/admin/photos/${inc.photo_file}`} alt={`Photo for ${inc.title}`} />
              </section>
            ) : null}

            <section className="card card-pad" style={{ position: "relative" }}>
              {inc.ai_status === "done" ? <span className="card-corner"><ConfidenceInfo value={inc.ai_confidence} /></span> : null}
              <div className="card-h" style={{ padding: "0 0 12px" }}><Icon name="ai" /><h2>Analysis</h2></div>
              {inc.ai_status === "done" ? (
                <dl className="kv">
                  <dt>Summary</dt><dd>{inc.ai_summary}</dd>
                  <dt>Category</dt><dd>{categoryLabel(inc.ai_category ?? "other")}{inc.ai_category !== inc.category ? <span className="tag" style={{ marginLeft: 6 }}>differs from reporter</span> : null}</dd>
                  <dt>Severity</dt><dd><span className={`tag sev sev-${inc.ai_severity}`}>{severityLabel(inc.ai_severity ?? "low")}</span></dd>
                  <dt>Why</dt><dd style={{ fontWeight: 400 }}>{inc.ai_reason}</dd>
                </dl>
              ) : aiBusy ? (
                <div><div className="analyzing" style={{ height: 56, borderRadius: 10 }} /><p className="muted">Analyzing the report{inc.photo_file ? " and photo" : ""}…</p></div>
              ) : (
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <p className="muted" style={{ margin: 0, flex: 1 }}>
                    {canRetry ? "Analysis couldn't finish. The rule-based severity is used." : "Automatic analysis is off. The rule-based severity is used."}
                  </p>
                  {canRetry ? (
                    <form action={retryAi}><input type="hidden" name="id" value={inc.id} /><button className="btn tonal sm"><Icon name="ai" className="ic sm" />Retry analysis</button></form>
                  ) : null}
                </div>
              )}
            </section>
          </div>

          <aside className="side-stack">
            <section className="card card-pad">
              <h2 style={{ fontSize: 15, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}><Icon name="people" />Response team</h2>
              {assigned ? (
                <>
                  <div className="team-now">
                    <div><b>{assigned.team.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{TEAM_KINDS[assigned.team.kind]} · {assigned.team.area}{assigned.km != null ? ` · ${assigned.km.toFixed(1)} km away` : ""}</div></div>
                    <CallButton phone={assigned.team.phone} who={`${assigned.team.name} via ${assigned.team.phone}`} label={`Call ${assigned.team.phone}`} />
                  </div>
                  {inc.assigned_at ? <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 0" }}>Assigned {new Date(inc.assigned_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p> : null}
                  {inc.status !== "resolved" ? (
                    <form action={unassignTeamAction} style={{ marginTop: 10 }}>
                      <input type="hidden" name="id" value={inc.id} />
                      <button className="btn text sm">Unassign team</button>
                    </form>
                  ) : null}
                </>
              ) : inc.status === "resolved" ? (
                <p className="muted" style={{ margin: 0 }}>No team was assigned.</p>
              ) : (
                <form action={assignTeamAction} className="form" style={{ gap: 10 }}>
                  <input type="hidden" name="id" value={inc.id} />
                  <select name="teamId" className="input" aria-label="Choose a team" defaultValue={ranked.find((r) => r.recommended)?.team.id}>
                    {ranked.map((r) => (
                      <option key={r.team.id} value={r.team.id} disabled={r.team.busyWith != null}>
                        {r.recommended ? "★ " : ""}{r.team.name} · {TEAM_KINDS[r.team.kind]}{r.km != null ? ` · ${r.km.toFixed(1)} km` : ""}{r.team.busyWith != null ? ` · busy (#${r.team.busyWith})` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>★ Recommended: right skills for this emergency, free, and nearest.</p>
                  {assignError ? <div className="err" role="alert">{assignError}</div> : null}
                  <button className="btn primary"><Icon name="send" className="ic sm" />Assign team</button>
                </form>
              )}
            </section>
            <section className="card card-pad">
              <h2 style={{ fontSize: 15, margin: "0 0 12px" }}>Update status</h2>
              <form action={setStatus} className="seg">
                <input type="hidden" name="id" value={inc.id} />
                {STATUSES.map((s) => (
                  <button key={s.id} name="status" value={s.id} className={inc.status === s.id ? "on" : ""} aria-pressed={inc.status === s.id}>
                    {inc.status === s.id ? <Icon name="check" className="ic sm" /> : null}{s.label}
                  </button>
                ))}
              </form>
              {inc.status !== "resolved" ? (
                <form action={setStatus} style={{ marginTop: 12 }}>
                  <input type="hidden" name="id" value={inc.id} />
                  <button name="status" value="resolved" className="btn primary block complete-btn">
                    <Icon name="checkCircle" className="ic sm" />Mark as complete
                  </button>
                </form>
              ) : (
                <div className="banner" style={{ marginTop: 12 }}><Icon name="checkCircle" />Completed{inc.team_id ? " · team is free again" : ""}</div>
              )}
            </section>

            <section className="card card-pad">
              <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>Severity</h2>
              <p className="muted" style={{ margin: "0 0 10px", fontSize: 12.5 }}>Rules said <b>{severityLabel(inc.rule_severity)}</b>. Override if needed.</p>
              <form action={setSeverity} className="seg">
                <input type="hidden" name="id" value={inc.id} />
                {SEVERITIES.map((s) => (
                  <button key={s} name="severity" value={s} className={`${inc.severity === s ? "on" : ""}`} aria-pressed={inc.severity === s}>
                    <span className={`sev-${s}`} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--sev)" }} />{severityLabel(s)}
                  </button>
                ))}
              </form>
            </section>

            <section className="card card-pad">
              <DeleteButton id={inc.id} title={inc.title} action={removeIncident} />
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
