import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Icon } from "@/components/Icon";
import { IncidentsMap } from "@/components/IncidentsMap";
import { ConfidenceInfo } from "@/components/ConfidenceInfo";
import { IncidentThumb } from "@/components/IncidentThumb";
import { getStats, listQueue } from "@/lib/incidents";
import { categoryLabel, severityLabel, statusLabel } from "@/lib/constants";
import { timeAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function QueuePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const queue = listQueue();
  const stats = getStats();
  const points = queue.filter((i) => i.lat != null && i.lng != null)
    .map((i) => ({ id: i.id, lat: i.lat!, lng: i.lng!, title: i.title, severity: i.severity }));

  const kpis = [
    { label: "Open incidents", value: stats.pending, icon: "list" },
    { label: "Critical (open)", value: stats.critical, icon: "warn", alert: stats.critical > 0 },
    { label: "Assigned incidents", value: stats.assigned, icon: "send" },
    { label: "Teams available", value: stats.teamsFree, icon: "check" },
    { label: "Teams busy", value: stats.teamsBusy, icon: "people" },
  ];

  return (
    <main className="page">
      <AutoRefresh seconds={10} />
      {sp.deleted ? <div className="banner"><Icon name="check" />Report deleted.</div> : null}

      <section className="kpis">
        {kpis.map((k) => (
          <div key={k.label} className={`card kpi ${k.alert ? "alert" : ""}`}>
            <div className="k-ic"><Icon name={k.icon} /></div>
            <div><div className="k-label">{k.label}</div><div className="k-val">{k.value}</div></div>
          </div>
        ))}
      </section>

      <div className="queue-grid">
        <section className="card">
          <div className="card-h"><h2>Incidents</h2><span className="muted">{queue.length} open</span><span className="grow" />
            <Link href="/admin/reports" className="btn text sm">All reports<Icon name="arrow" className="ic sm" /></Link></div>
          {queue.length === 0 ? <div className="empty">No open incidents. All clear.</div> : queue.map((i, idx) => (
            <Link key={i.id} href={`/admin/incidents/${i.id}`}
              className={`q-item sev-${i.severity} ${i.severity === "critical" ? "is-critical" : ""}`} style={{ animationDelay: `${Math.min(idx, 12) * 25}ms` }}>
              {i.ai_status === "done" ? <ConfidenceInfo value={i.ai_confidence} /> : null}
              <span className="q-rank">{idx + 1}</span>
              <span className="inc">
                <IncidentThumb photo={i.photo_file} category={i.category} title={i.title} size={44} />
                <span style={{ minWidth: 0 }}>
                  <span className="inc-title">{i.is_sos ? <span className="sos-badge">SOS</span> : null}{i.seen_at == null ? <span className="new-badge">New</span> : null}{i.title}</span>
                  <span className="inc-meta"><Icon name="pin" className="ic sm" />{i.location}</span>
                  <span className="inc-meta">
                    {categoryLabel(i.category)} · <Icon name="people" className="ic sm" />{i.people_affected}
                    {i.team_name ? <span className="tag"><Icon name="send" />{i.team_name}</span> : <span className="tag warn-tag">No team yet</span>}
                                        {i.ai_status === "queued" || i.ai_status === "running" ? <span className="tag ai analyzing"><Icon name="ai" />Analyzing…</span> : null}
                  </span>
                </span>
              </span>
              <span className="q-side">
                <span className="tag sev">{i.severity === "critical" ? <span className="pulse-dot" /> : null}{severityLabel(i.severity)}</span>
                <span className={`status st-${i.status}`}><i />{statusLabel(i.status)}</span>
                <span className="muted" style={{ fontSize: 12 }}>{timeAgo(i.created_at)}</span>
              </span>
            </Link>
          ))}
        </section>

        <section className="card">
          <div className="card-h"><Icon name="map" /><h2>Live map</h2><span className="grow" /><span className="muted">{points.length} with GPS</span></div>
          <IncidentsMap points={points} height={420} />
        </section>
      </div>
    </main>
  );
}
