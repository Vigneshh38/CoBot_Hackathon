import { AutoRefresh } from "@/components/AutoRefresh";
import { Icon } from "@/components/Icon";
import { AddTeam } from "./TeamForm";
import { TeamTable } from "./TeamTable";
import { listTeams } from "@/lib/incidents";

export const dynamic = "force-dynamic";

export default async function TeamsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const teams = listTeams();
  const working = teams.filter((t) => t.busyWith != null);
  const free = teams.filter((t) => t.busyWith == null);
  return (
    <main className="page">
      <AutoRefresh seconds={15} />
      <div className="page-head">
        <div>
          <h1>Response teams</h1>
          <p className="lead">A team is free again when its incident is resolved.</p>
          <div style={{ marginTop: 12 }}><AddTeam /></div>
        </div>
        <div className="duty-stats" aria-label="Team availability">
          <div className="duty-stat duty">
            <span className="ds-ic"><span className="work-dot" /></span>
            <div><div className="ds-val">{working.length}</div><div className="ds-label">On duty</div></div>
          </div>
          <div className="duty-stat free">
            <span className="ds-ic"><Icon name="check" className="ic sm" /></span>
            <div><div className="ds-val">{free.length}</div><div className="ds-label">Available</div></div>
          </div>
          <div className="duty-bar" title={`${working.length} of ${teams.length} teams on duty`}>
            <i style={{ width: `${teams.length ? (working.length / teams.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {sp.deleted && sp.deleted !== "0" ? <div className="banner"><Icon name="check" />{sp.deleted === "1" ? "Team deleted." : `${sp.deleted} teams deleted.`}</div> : null}
      {sp.error ? <div className="card err" role="alert" style={{ padding: 14 }}>{sp.error}</div> : null}

      <TeamTable teams={teams.map((t) => ({ ...t }))} /* sqlite rows have a null prototype; client props need plain objects */ />
    </main>
  );
}
