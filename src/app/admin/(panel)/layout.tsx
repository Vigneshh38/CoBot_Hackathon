import { requireAdmin } from "@/lib/auth";
import { countUnseen } from "@/lib/incidents";
import { AdminRail } from "./AdminRail";
import { Icon } from "@/components/Icon";
import { Backdrop, BackdropCredit } from "@/components/Backdrop";
import { AdminSosAlarm } from "@/components/AdminSosAlarm";
import { logout } from "@/app/admin/actions";

// Every page in the admin panel requires a signed-in admin (checked here and again in each server action).
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
    <Backdrop variant="admin" />
    <div className="shell on-bd">
      <AdminRail unseen={countUnseen()} />
      <div className="shell-main">
        <AdminSosAlarm />
        <form action={logout} className="signout">
          <button className="btn tonal sm"><Icon name="logout" className="ic sm" />Sign out</button>
        </form>
        {children}
        <BackdropCredit variant="admin" />
      </div>
    </div>
    </>
  );
}
