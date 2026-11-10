import { Backdrop, BackdropCredit } from "@/components/Backdrop";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Logo";
import { AutoRefresh } from "@/components/AutoRefresh";
import { getIncidentByCode } from "@/lib/incidents";
import { categoryLabel, STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function TrackPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const inc = /^[A-F0-9]{10}$/.test(code) ? getIncidentByCode(code) : undefined;
  if (!inc) notFound();
  const reached = STATUSES.findIndex((s) => s.id === inc.status);

  return (
    <>
      <AutoRefresh seconds={15} />
      <Backdrop />
      <main className="page narrow on-bd">
        <div className="brand-row"><Logo size={44} /></div>
        <section className="card card-pad" style={{ textAlign: "center" }}>
          <div className="success-ic"><Icon name="check" className="ic lg" /></div>
          <h1>Report received</h1>
          <p className="lead">Help is being coordinated. Keep this code to check the status.</p>
          <p style={{ margin: "16px 0 4px" }}><span className="code">{inc.code}</span></p>
          <p className="muted" style={{ margin: 0 }}>Bookmark this page — it updates automatically.</p>
        </section>

        <section className="card card-pad">
          <div className="steps" aria-label="Progress">
            {STATUSES.map((s, i) => (
              <div key={s.id} className={`step ${i <= reached ? "done" : ""}`}>
                <i>{i <= reached ? <Icon name="check" className="ic sm" /> : null}</i>{s.label}
              </div>
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <dl className="kv">
            <dt>Incident</dt><dd>{inc.title}</dd>
            <dt>Category</dt><dd>{categoryLabel(inc.category)}</dd>
            <dt>Location</dt><dd>{inc.location}</dd>
            <dt>People affected</dt><dd>{inc.people_affected}</dd>
            <dt>Reported</dt><dd>{new Date(inc.created_at).toLocaleString("en-IN")}</dd>
          </dl>
        </section>

        <div className="callbar">
          <a href="tel:112" className="call"><Icon name="phone" /><span>Still in danger? Call 112</span></a>
        </div>
        <Link href="/" className="back"><Icon name="arrowLeft" className="ic sm" />Report another emergency</Link>
        <BackdropCredit />
      </main>
    </>
  );
}
