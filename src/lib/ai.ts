import "server-only";
import { spawn } from "node:child_process";
import path from "node:path";
import { setAiStatus } from "./incidents.ts";

/**
 * AI triage via Claude Code headless mode.
 * The web request only marks the incident "queued" and starts the detached worker (scripts/ai-worker.ts),
 * so reporting is never slowed down and the job survives short-lived request processes.
 * The worker runs jobs one at a time, allows Claude only the Read tool, and validates every reply.
 */
const enabled = () => process.env.AI_ENABLED !== "false";

export function queueAnalysis(id: number) {
  if (!enabled()) { setAiStatus(id, "none"); return; }
  setAiStatus(id, "queued");
  const worker = /*turbopackIgnore: true*/ path.join(process.cwd(), "scripts", "ai-worker.ts");
  const child = spawn(process.execPath, [worker], { cwd: process.cwd(), detached: true, stdio: "ignore", windowsHide: true });
  child.on("error", (e) => console.error("[ai] could not start worker:", e.message));
  child.unref();
}
