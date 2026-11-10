import { isAdmin } from "@/lib/auth";
import { listLivePositions } from "@/lib/incidents";

export const dynamic = "force-dynamic";

/** Latest vehicle positions for the admin map (admin only; polled every few seconds). */
export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ now: new Date().toISOString(), positions: listLivePositions() });
}
