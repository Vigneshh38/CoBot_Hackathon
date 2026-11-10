import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { getTeamByToken } from "@/lib/incidents";
import { TEAM_KINDS } from "@/lib/dispatch";
import { Tracker } from "./Tracker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vehicle tracking · ResQure", robots: { index: false, follow: false } };

/** The crew's page: open on the vehicle's phone to share its live GPS with the control room. No login; the link is the key. */
export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const team = getTeamByToken(token);
  return (
    <main className="page narrow track-page">
      <div className="brand-row"><Logo size={40} /></div>
      {team ? (
        <>
          <div>
            <h1>{team.name}</h1>
            <p className="lead">{TEAM_KINDS[team.kind]} · {team.area}</p>
          </div>
          <Tracker token={token} initialJob={team.job} />
        </>
      ) : (
        <div className="card card-pad">
          <h1 style={{ fontSize: 20 }}><Icon name="lock" /> Link not valid</h1>
          <p className="muted">This tracking link is wrong or was replaced. Ask the control room for the current link.</p>
        </div>
      )}
    </main>
  );
}
