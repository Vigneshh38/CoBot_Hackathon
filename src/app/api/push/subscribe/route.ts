import { NextRequest } from "next/server";
import { pushSubSchema } from "@/lib/validation";
import { saveSubscription } from "@/lib/push";
import { isAdmin } from "@/lib/auth";

/** Save/refresh this browser's push subscription and its last known location (used for nearby SOS alerts). */
export async function POST(req: NextRequest) {
  const parsed = pushSubSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid subscription." }, { status: 400 });
  const { deviceId, role, subscription, lat, lng } = parsed.data;
  if (role === "admin" && !(await isAdmin())) return Response.json({ error: "Sign in as admin." }, { status: 401 });
  saveSubscription({ endpoint: subscription.endpoint, ...subscription.keys, deviceId, role, lat, lng });
  return Response.json({ ok: true });
}
