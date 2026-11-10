import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { Backdrop, BackdropCredit } from "@/components/Backdrop";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <>
    <Backdrop variant="admin" />
    <main className="login on-bd" style={{ minHeight: "100vh" }}>
      <section className="card card-pad">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}><Logo size={46} /></div>
        <h1>Admin sign in</h1>
        <p className="lead" style={{ marginBottom: 20 }}>Access the emergency control dashboard.</p>
        <LoginForm />
      </section>
      <BackdropCredit variant="admin" />
    </main>
    </>
  );
}
