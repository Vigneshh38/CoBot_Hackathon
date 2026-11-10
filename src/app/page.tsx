import { Backdrop, BackdropCredit } from "@/components/Backdrop";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Logo";
import { ReportForm } from "./ReportForm";
import { InstallSos } from "@/components/InstallSos";
import { AlertsOptIn } from "@/components/AlertsOptIn";
import { RegisterSW } from "@/components/RegisterSW";

export default function Home() {
  return (
    <>
      <Backdrop />
      <main className="page narrow on-bd">
        <div className="brand-row"><Logo size={48} /><InstallSos /></div>
        <div className="hero">
          <span className="eyebrow"><i />Control room online</span>
          <h1>Report an emergency</h1>
          <p className="lead">Tell us what happened. Your report goes straight to the control room.</p>
        </div>
        <RegisterSW />
        <AlertsOptIn />
        <div className="callbar">
          <a href="tel:112" className="call"><Icon name="phone" /><span>Call 112<small>All emergencies</small></span></a>
          <a href="tel:108" className="call"><Icon name="medical" /><span>Call 108<small>Ambulance</small></span></a>
          <a href="tel:101" className="call"><Icon name="fire" /><span>Call 101<small>Fire</small></span></a>
          <a href="tel:100" className="call"><Icon name="shield" /><span>Call 100<small>Police</small></span></a>
        </div>
        <section className="card card-pad">
          <ReportForm />
        </section>
        <BackdropCredit />
      </main>
    </>
  );
}
