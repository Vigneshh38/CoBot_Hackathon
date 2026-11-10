/**
 * Background AI worker (run with Node 24: `node scripts/ai-worker.ts`).
 * Started detached by the web app after each report. It processes every incident with ai_status='queued',
 * one at a time, then exits. A lock file makes sure only one worker runs at once.
 * Running outside the request process means the job survives short-lived request workers and restarts.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildPrompt, higherSeverity, type PromptInput } from "../src/lib/ai-prompt.ts";
import { parseAiReply } from "../src/lib/validation.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(DATA, "uploads");
const LOCK = path.join(DATA, "ai-worker.lock");
const TIMEOUT_MS = 120_000;
const LOG = path.join(DATA, "ai-worker.log");
const log = (msg: string) => fs.appendFileSync(LOG, `${new Date().toISOString()} ${msg}` + os.EOL);
process.loadEnvFile?.(path.join(ROOT, ".env"));

function takeLock(): boolean {
  try {
    fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" });
    return true;
  } catch {
    const pid = Number(fs.readFileSync(LOCK, "utf8"));
    try { process.kill(pid, 0); return false; } catch { /* holder is gone: stale lock */ }
    fs.writeFileSync(LOCK, String(process.pid));
    return true;
  }
}

const MEDIA: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Env for `claude`: drop API-key/proxy/session variables so it uses the logged-in Claude account (same as D:\ssapp). */
function claudeEnv(): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(ANTHROPIC_|CLAUDE)/i.test(k))) as NodeJS.ProcessEnv;
}

/**
 * Headless Claude: the photo goes inline (base64) in a stream-json message, with NO tools enabled,
 * no MCP servers, project-only settings and no saved session — fast and locked down.
 */
function runClaude(prompt: string, photoFile: string | null): Promise<string> {
  return new Promise((resolve, reject) => {
    const content: unknown[] = [];
    if (photoFile) {
      const ext = photoFile.split(".").pop()!.toLowerCase();
      const data = fs.readFileSync(path.join(UPLOADS, photoFile)).toString("base64");
      content.push({ type: "image", source: { type: "base64", media_type: MEDIA[ext] ?? "image/jpeg", data } });
    }
    content.push({ type: "text", text: prompt });
    const message = JSON.stringify({ type: "user", message: { role: "user", content } }) + "\n";

    const args = ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
      "--model", process.env.AI_MODEL || "haiku", "--tools", "", "--setting-sources", "project",
      "--strict-mcp-config", "--no-session-persistence"];
    const child = spawn(process.env.CLAUDE_BIN || "claude", args, { cwd: os.tmpdir(), env: claudeEnv(), windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("timed out")); }, TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      let result: { result?: string; is_error?: boolean } | null = null;
      for (const line of out.split(String.fromCharCode(10)).map((l) => l.trim())) {
        try { const item = JSON.parse(line); if (item.type === "result") result = item; } catch { /* not JSON */ }
      }
      if (!result) return reject(new Error(`no result (exit ${code}): ${(err || out).slice(0, 300)}`));
      if (result.is_error || typeof result.result !== "string") return reject(new Error(`claude error: ${String(result.result).slice(0, 200)}`));
      resolve(result.result);
    });
    child.stdin.end(message);
  });
}

async function main() {
  if (!takeLock()) return;
  const db = new DatabaseSync(path.join(DATA, "app.db"));
  const now = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
  try {
    for (;;) {
      const inc = db.prepare("SELECT * FROM incidents WHERE ai_status = 'queued' ORDER BY id LIMIT 1").get() as
        (PromptInput & { id: number; severity: string }) | undefined;
      if (!inc) break;
      db.prepare(`UPDATE incidents SET ai_status = 'running', updated_at = ${now} WHERE id = ?`).run(inc.id);
      try {
        const reply = await runClaude(buildPrompt(inc), inc.photo_file);
        const r = parseAiReply(reply);
        if (!r) throw new Error(`unusable reply: ${reply.slice(0, 200)}`);
        db.prepare(`UPDATE incidents SET ai_status = 'done', ai_category = ?, ai_severity = ?, ai_summary = ?, ai_reason = ?,
            ai_confidence = ?, severity = ?, updated_at = ${now} WHERE id = ?`)
          .run(r.category, r.severity, r.summary, r.reason, Math.round(r.confidence), higherSeverity(inc.severity, r.severity), inc.id);
        log(`incident ${inc.id}: ${r.severity} (${r.confidence}%)`);
      } catch (e) {
        log(`incident ${inc.id} FAILED: ${(e as Error).message}`);
        db.prepare(`UPDATE incidents SET ai_status = 'failed', updated_at = ${now} WHERE id = ?`).run(inc.id);
      }
    }
  } finally {
    db.close();
    fs.rmSync(LOCK, { force: true });
  }
}

main();
