import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./db.ts";

export type SmsResult = "sent" | "logged" | "failed";

/**
 * One SMS channel for the whole app. With TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM in .env
 * it sends a real SMS through Twilio; otherwise it prints the SMS in the server terminal and saves it
 * to data/outbox/ (demo mode). Never throws.
 */
export async function sendSms(to: string, text: string): Promise<SmsResult> {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = process.env;
  try {
    if (sid && token && from) {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: to, From: from, Body: text }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Twilio ${res.status}`);
      return "sent";
    }
    console.log(`[sms demo] to ${to}: ${text}`);
    const dir = /*turbopackIgnore: true*/ path.join(DATA_DIR, "outbox");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(/*turbopackIgnore: true*/ path.join(dir, `${Date.now()}-sms-${to.replace(/\D/g, "")}.txt`), `To: ${to}\n\n${text}\n`);
    return "logged";
  } catch (e) {
    console.error(`[sms] to ${to} failed:`, (e as Error).message);
    return "failed";
  }
}
