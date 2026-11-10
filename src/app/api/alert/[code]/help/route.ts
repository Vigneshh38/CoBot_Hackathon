import { NextRequest } from "next/server";
import { addHelper, getIncidentByCode } from "@/lib/incidents";

/** A nearby person tapped "I'm going to help". Only for open SOS alerts; the page asks once per device. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const inc = /^[A-F0-9]{10}$/.test(code) ? getIncidentByCode(code) : undefined;
  if (!inc || !inc.is_sos || inc.status === "resolved") return Response.json({ error: "This alert has ended." }, { status: 404 });
  addHelper(inc.id);
  return Response.json({ helpers: inc.helpers + 1 });
}
