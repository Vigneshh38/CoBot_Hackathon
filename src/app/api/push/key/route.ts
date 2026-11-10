import { vapidKeys } from "@/lib/push";

/** Public VAPID key the browser needs to subscribe to push (safe to share). */
export function GET() {
  return Response.json({ key: vapidKeys().publicKey });
}
