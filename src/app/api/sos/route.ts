import { NextRequest } from "next/server";
import { sosSchema } from "@/lib/validation";
import { createSosIncident, lastOpenSos, markRealert, setAlertedNearby } from "@/lib/incidents";
import { sendSosPushes } from "@/lib/push";
import { sendSms } from "@/lib/sms";
import { cleanPhones, familySmsText } from "@/lib/nearby";

/** Minutes during which a repeat SOS from the same phone/device re-alerts the open incident instead of creating a new one. */
const cooldownMin = () => Number(process.env.SOS_COOLDOWN_MIN ?? 10);
/** Re-alerts for the same incident are sent at most this often. */
const REALERT_MS = 60_000;

/**
 * One-tap SOS. Saves a Critical incident first (so the control room always gets it), then
 * alerts opted-in people within 3 km by browser push, admin devices, and the person's family by SMS.
 * Pressing SOS again while that incident is open re-alerts nearby people (no duplicate incident, no repeat SMS).
 */
export async function POST(req: NextRequest) {
  const parsed = sosSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid SOS request." }, { status: 400 });
  const input = { ...parsed.data, familyPhones: cleanPhones(parsed.data.familyPhones) };

  const prev = lastOpenSos(input.deviceId, input.contactPhone);
  if (prev && Date.now() - new Date(prev.created_at).getTime() < cooldownMin() * 60_000) {
    const since = Date.now() - new Date(prev.last_alert_at ?? prev.created_at).getTime();
    if (since < REALERT_MS) {
      return Response.json({ error: "Your SOS was sent less than a minute ago. Help is on the way. If it is getting worse, call 112.", retryInSec: Math.ceil((REALERT_MS - since) / 1000) }, { status: 429 });
    }
    const inc = markRealert(prev.id, input.lat, input.lng);
    const push = await sendSosPushes(inc);
    setAlertedNearby(inc.id, push.nearby);
    return Response.json({ code: inc.code, repeat: true, nearby: push.nearby, admins: push.admins, family: 0, familyDemo: false,
      smsText: familySmsText(inc.contact_name, inc.location, inc.lat, inc.lng) });
  }

  const inc = createSosIncident(input);
  const sms = familySmsText(inc.contact_name, inc.location, inc.lat, inc.lng);
  const [push, smsResults] = await Promise.all([
    sendSosPushes(inc),
    Promise.all(input.familyPhones.map((p) => sendSms(p, sms))),
  ]);
  setAlertedNearby(inc.id, push.nearby);

  return Response.json({
    code: inc.code,
    nearby: push.nearby,
    admins: push.admins,
    family: smsResults.filter((r) => r !== "failed").length,
    familyDemo: smsResults.includes("logged"), // no SMS provider configured: printed in the server terminal
    smsText: sms,
  });
}
