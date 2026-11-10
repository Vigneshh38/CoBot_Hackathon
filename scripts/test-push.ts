/**
 * Sends a test notification to every phone that turned on SOS alerts (location not needed).
 * Usage: npm run push:test   (run from the project folder; uses data/app.db and data/vapid.json)
 */
export {};
const { sendTestPush, countSubs } = await import("../src/lib/push.ts");
console.log("Subscriptions:", countSubs());
const r = await sendTestPush();
console.log(`Test push sent to ${r.ok} of ${r.total} device(s).`);
