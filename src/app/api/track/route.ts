import { NextRequest } from "next/server";
import { getTeamByToken, saveTeamFix } from "@/lib/incidents";
import { acceptFix, fixSchema, fixTime, hasArrived } from "@/lib/tracking";

/**
 * Vehicle location feed. The crew's phone (/track/<token>) or an in-vehicle GPS unit POSTs its position here:
 *   POST /api/track
 *   Authorization: Bearer <team tracking token>
 *   { "lat": 13.05, "lng": 80.25, "accuracy": 12, "speed": 11.2, "heading": 90, "at": 1794300000000 }
 * Replies with the team's current job so the device can show where to go.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const team = getTeamByToken(token);
  if (!team) return Response.json({ error: "Unknown or revoked tracking link" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = fixSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid position" }, { status: 400 });

  const now = Date.now();
  const verdict = acceptFix(parsed.data, team.live_at, now);
  if (verdict.ok) saveTeamFix(team.id, parsed.data, fixTime(parsed.data.at, now));

  const job = team.job;
  const arrived = job && job.lat != null && job.lng != null ? hasArrived(parsed.data, { lat: job.lat, lng: job.lng }) : false;
  return Response.json({ ok: true, stored: verdict.ok, reason: verdict.ok ? undefined : verdict.reason, team: { name: team.name }, job, arrived });
}
