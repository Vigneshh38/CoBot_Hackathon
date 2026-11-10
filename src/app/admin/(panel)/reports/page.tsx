import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Icon } from "@/components/Icon";
import { ConfidenceInfo } from "@/components/ConfidenceInfo";
import { IncidentThumb } from "@/components/IncidentThumb";
import { requireAdmin } from "@/lib/auth";
import { getAnalytics, getStats, listIncidents } from "@/lib/incidents";
import { BarList, HourlyColumns, Ring } from "@/components/Charts";
import { formatMinutes } from "@/lib/analytics";
import { CATEGORIES, SEVERITIES, STATUSES, categoryLabel, severityLabel, statusLabel } from "@/lib/constants";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

function timeAgo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : new Date(iso).toLocaleDateString("en-IN");
}

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = { status: one(sp.status), severity: one(sp.severity), category: one(sp.category), q: one(sp.q) };
  const stats = getStats();
  const an = getAnalytics();
  const last24 = an.hourly.reduce((n, b) => n + b.n, 0);
  const rows = listIncidents(filter);
  const maxCat = Math.max(1, ...stats.byCategory.map((c) => c.n));
  const filtered = Object.values(filter).some(Boolean);

  const kpis = [
    { label: "Total reported", value: stats.total, icon: "list" },
    { label: "Critical (open)", value: stats.critical, icon: "warn", alert: stats.critical > 0 },
    { label: "Open", value: stats.pending, icon: "clock" },
    { label: "Assigned", value: stats.assigned, icon: "send" },
    { label: "Resolved", value: stats.resolved, icon: "checkCircle" },
    { label: "Teams available", value: stats.teamsFree, icon: "check" },
    { label: "Teams busy", value: stats.teamsBusy, icon: "people" },
  ];

  return (
    <>
      <AutoRefresh seconds={10} />
      <main className="page">
        <div>
          <h1>Reports</h1>
          <p className="lead">Emergency statistics and the full incident log. Critical incidents are listed first.</p>
        </div>

        <section className="kpis">
          {kpis.map((k) => (
            <div key={k.label} className={`card kpi ${k.alert ? "alert" : ""}`}>
              <div className="k-ic"><Icon name={k.icon} /></div>
              <div><div className="k-label">{k.label}</div><div className="k-val">{k.value}</div></div>
            </div>
          ))}
        </section>

        <section className="analytics" aria-label="Analytics">
          <div className="card">
            <div className="card-h"><Icon name="chart" /><h2>Reports in the last 24 hours</h2><span className="grow" /><span className="muted">{last24} total</span></div>
            <div className="chart-body"><HourlyColumns buckets={an.hourly} /></div>
          </div>
          <div className="card">
            <div className="card-h"><Icon name="people" /><h2>Team utilisation</h2></div>
            <div className="chart-body">
              <Ring value={stats.teamsBusy} total={stats.teamsTotal} label={`${stats.teamsBusy} busy · ${stats.teamsFree} available`}
                sub={`Average time to assign a team: ${formatMinutes(an.avgAssignMin)}`} />
            </div>
          </div>
          <div className="card">
            <div className="card-h"><Icon name="list" /><h2>Incidents by status</h2></div>
            <div className="chart-body">
              <BarList caption="Incidents by status" items={an.byStatus.map((st) => ({ key: st.id, label: st.label, value: st.n, href: `/admin/reports?status=${st.id}` }))} />
            </div>
          </div>
          <div className="card">
            <div className="card-h"><Icon name="warn" /><h2>Open incidents by severity</h2></div>
            <div className="chart-body">
              <BarList caption="Open incidents by severity" items={an.openBySeverity.map((sv) => ({ key: sv.id, label: severityLabel(sv.id), value: sv.n, tone: sv.id, href: `/admin/reports?severity=${sv.id}` }))} />
            </div>
          </div>
        </section>

        <div className="dash-grid">
          <section className="card">
            <div className="card-h"><h2>All incidents</h2><span className="muted">{rows.length} shown</span></div>
            <form className="filters" method="get" action="/admin/reports">
              <input name="q" className="input search" placeholder="Search title, place or code" defaultValue={filter.q} aria-label="Search" />
              <select name="status" className="input" defaultValue={filter.status ?? ""} aria-label="Status">
                <option value="">All statuses</option>
                {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <select name="severity" className="input" defaultValue={filter.severity ?? ""} aria-label="Severity">
                <option value="">All severities</option>
                {SEVERITIES.map((s) => <option key={s} value={s}>{severityLabel(s)}</option>)}
              </select>
              <select name="category" className="input" defaultValue={filter.category ?? ""} aria-label="Category">
                <option value="">All categories</option>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <button className="btn tonal sm"><Icon name="search" className="ic sm" />Apply</button>
              {filtered ? <Link href="/admin/reports" className="btn text sm">Clear</Link> : null}
            </form>

            {rows.length === 0 ? (
              <div className="empty">{filtered ? "No incidents match these filters." : "No incidents reported yet."}</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr><th>Incident</th><th>Severity</th><th className="hide-sm">People</th><th>Status</th><th className="hide-sm">Reported</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={r.id} className={`sev-${r.severity} ${r.severity === "critical" && r.status !== "resolved" ? "is-critical" : ""} ${r.status === "resolved" ? "is-resolved" : ""}`}
                        style={{ animationDelay: `${Math.min(idx, 12) * 25}ms` }}>
                        <td>
                          <Link href={`/admin/incidents/${r.id}`} className="inc">
                            <IncidentThumb photo={r.photo_file} category={r.category} title={r.title} />
                            <span>
                              <span className="inc-title">{r.seen_at == null ? <span className="new-badge">New</span> : null}{r.title}</span>
                              <span className="inc-meta">
                                <Icon name="pin" className="ic sm" />{r.location}
                                <span>· {categoryLabel(r.category)}</span>
                                {r.ai_status === "done" ? <ConfidenceInfo value={r.ai_confidence} /> : null}
                                {r.ai_status === "queued" || r.ai_status === "running" ? <span className="tag ai analyzing"><Icon name="ai" />Analyzing…</span> : null}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td>
                          <span className="tag sev">
                            {r.severity === "critical" && r.status !== "resolved" ? <span className="pulse-dot" /> : null}
                            {severityLabel(r.severity)}
                          </span>
                        </td>
                        <td className="hide-sm">{r.people_affected}</td>
                        <td><span className={`status st-${r.status}`}><i />{statusLabel(r.status)}</span></td>
                        <td className="hide-sm muted">{timeAgo(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="side-stack">
            <section className="card">
              <div className="card-h"><Icon name="chart" /><h2>Incidents by category</h2></div>
              <div className="bars">
                {stats.byCategory.map((c) => (
                  <Link key={c.id} href={`/admin/reports?category=${c.id}`} className="bar-row" title={`Show ${c.label}`}>
                    <Icon name={c.id} />
                    <div>{c.label}<div className="track"><i style={{ width: `${(c.n / maxCat) * 100}%` }} /></div></div>
                    <b>{c.n}</b>
                  </Link>
                ))}
              </div>
            </section>
            <section className="card card-pad">
              <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>Severity guide</h2>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {SEVERITIES.map((s) => <span key={s} className={`tag sev sev-${s}`}>{severityLabel(s)}</span>)}
              </div>
              <p className="muted" style={{ margin: "10px 0 0", fontSize: 12.5 }}>
                Set by rules (category, people affected, danger words), then automatic analysis of the report and photo can raise it. Admins can override.
              </p>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
