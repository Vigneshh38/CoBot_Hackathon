import { isAdmin } from "@/lib/auth";
import { listUnseenSos } from "@/lib/incidents";

/** Admin-only: open SOS incidents not opened yet. The admin panel polls this to ring the siren. */
export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: "Sign in as admin." }, { status: 401 });
  return Response.json({ sos: listUnseenSos() });
}
