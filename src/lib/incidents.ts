import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db, newTrackToken, UPLOAD_DIR } from "./db.ts";
import type { Fix } from "./tracking.ts";
import { categoryLabel, CATEGORIES, SEVERITIES, STATUSES, severityRank, type Category, type Severity, type Status } from "./constants.ts";
import { classifySeverity } from "./severity.ts";
import { rankByPriority, type Priority } from "./priority.ts";
import { averageMinutes, hourlyBuckets } from "./analytics.ts";
import type { AiResult, ReportInput, TeamInput } from "./validation.ts";
import type { TeamKind } from "./dispatch.ts";

export interface Incident {
  id: number;
  code: string;
  title: string;
  description: string;
  category: Category;
  location: string;
  lat: number | null;
  lng: number | null;
  people_affected: number;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  photo_file: string | null;
  severity: Severity;
  rule_severity: Severity;
  severity_reasons: string;
  status: Status;
  ai_status: "none" | "queued" | "running" | "done" | "failed";
  ai_category: Category | null;
  ai_severity: Severity | null;
  ai_summary: string | null;
  ai_reason: string | null;
  ai_confidence: number | null;
  team_id: number | null;
  assigned_at: string | null;
  seen_at: string | null;
  is_sos: number;
  device_id: string | null;
  helpers: number;
  alerted_nearby: number;
  family_phones: string | null;
  last_alert_at: string | null;
  team_name?: string | null;
  created_at: string;
  updated_at: string;
}

const newCode = () => crypto.randomBytes(5).toString("hex").toUpperCase(); // unguessable tracking code

export function createIncident(input: ReportInput, photo?: { bytes: Buffer; ext: string }): Incident {
  const rule = classifySeverity({
    category: input.category,
    peopleAffected: input.peopleAffected,
    text: `${input.title ?? ""} ${input.description}`,
  });
  const title = input.title ?? `${categoryLabel(input.category)} at ${input.location.split(",")[0].slice(0, 60)}`;
  const code = newCode();

  let photoFile: string | null = null;
  if (photo) {
    photoFile = `${code}.${photo.ext}`; // our own name, never the user's filename
    fs.writeFileSync(/*turbopackIgnore: true*/ path.join(UPLOAD_DIR, photoFile), photo.bytes);
  }

  const res = db
    .prepare(
      `INSERT INTO incidents (code, title, description, category, location, lat, lng, people_affected,
        contact_name, contact_phone, contact_email, photo_file, severity, rule_severity, severity_reasons, ai_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      code, title, input.description, input.category, input.location, input.lat ?? null, input.lng ?? null,
      input.peopleAffected, input.contactName ?? null, input.contactPhone ?? null, input.contactEmail ?? null, photoFile,
      rule.severity, rule.severity, JSON.stringify(rule.reasons), "queued",
    );
  return getIncident(Number(res.lastInsertRowid))!;
}

export interface SosInput {
  lat?: number;
  lng?: number;
  accuracy?: number;
  location?: string;
  contactName?: string;
  contactPhone?: string;
  familyPhones: string[];
  deviceId: string;
}

/** One-tap SOS: no form. Always Critical, no AI (there is no photo or text to analyse). */
export function createSosIncident(input: SosInput): Incident {
  const hasGps = input.lat != null && input.lng != null;
  const location = input.location || (hasGps ? `GPS ${input.lat!.toFixed(5)}, ${input.lng!.toFixed(5)}` : "Location unavailable (GPS off)");
  const acc = input.accuracy ? ` GPS accuracy ±${Math.round(input.accuracy)} m.` : "";
  const code = newCode();
  const res = db.prepare(
    `INSERT INTO incidents (code, title, description, category, location, lat, lng, people_affected, contact_name, contact_phone,
       severity, rule_severity, severity_reasons, ai_status, is_sos, device_id, family_phones)
     VALUES (?, ?, ?, 'other', ?, ?, ?, 1, ?, ?, 'critical', 'critical', ?, 'none', 1, ?, ?)`,
  ).run(
    code, `SOS at ${location.split(",")[0].slice(0, 60)}`,
    `SOS one-tap alert. The person could not fill the report form and needs help now.${acc}`,
    location, input.lat ?? null, input.lng ?? null, input.contactName ?? null, input.contactPhone ?? null,
    JSON.stringify(["SOS: person in danger, could not fill the form"]), input.deviceId,
    input.familyPhones.length ? JSON.stringify(input.familyPhones) : null,
  );
  return getIncident(Number(res.lastInsertRowid))!;
}

/** The latest SOS from this device or phone that is still open (a repeat press re-alerts it). */
export function lastOpenSos(deviceId: string, phone?: string): Incident | undefined {
  return db.prepare(`SELECT * FROM incidents WHERE is_sos = 1 AND status != 'resolved'
      AND (device_id = ? OR (? IS NOT NULL AND contact_phone = ?)) ORDER BY created_at DESC LIMIT 1`)
    .get(deviceId, phone ?? null, phone ?? null) as Incident | undefined;
}

/** Repeat SOS press: refresh the position (the person may have moved) and stamp the re-alert time. */
export function markRealert(id: number, lat?: number, lng?: number): Incident {
  db.prepare(`UPDATE incidents SET lat = COALESCE(?, lat), lng = COALESCE(?, lng),
      last_alert_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(lat ?? null, lng ?? null, id);
  return getIncident(id)!;
}

/** Keeps the highest count across the first alert and any re-alerts. */
export function setAlertedNearby(id: number, n: number) {
  db.prepare("UPDATE incidents SET alerted_nearby = MAX(alerted_nearby, ?) WHERE id = ?").run(n, id);
}

/** A nearby person tapped "I'm going to help". */
export function addHelper(id: number) {
  db.prepare("UPDATE incidents SET helpers = helpers + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(id);
}

/** Open SOS incidents the admin hasn't opened yet (drives the control-room siren). */
export const listUnseenSos = () =>
  db.prepare("SELECT id, code, title, location, created_at FROM incidents WHERE is_sos = 1 AND seen_at IS NULL AND status != 'resolved' ORDER BY created_at DESC LIMIT 20")
    .all() as { id: number; code: string; title: string; location: string; created_at: string }[];

export const getIncident = (id: number) =>
  db.prepare("SELECT * FROM incidents WHERE id = ?").get(id) as Incident | undefined;

export const getIncidentByCode = (code: string) =>
  db.prepare("SELECT * FROM incidents WHERE code = ?").get(code) as Incident | undefined;

export interface ListFilter {
  status?: string;
  severity?: string;
  category?: string;
  q?: string;
}

/** Open critical incidents first, then by severity, then newest. */
export function listIncidents(f: ListFilter = {}): Incident[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (f.status) { where.push("status = ?"); args.push(f.status); }
  if (f.severity) { where.push("severity = ?"); args.push(f.severity); }
  if (f.category) { where.push("category = ?"); args.push(f.category); }
  if (f.q) {
    where.push("(title LIKE ? OR description LIKE ? OR location LIKE ? OR code LIKE ?)");
    const like = `%${f.q}%`;
    args.push(like, like, like, like);
  }
  const sql = `SELECT * FROM incidents ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY (status = 'resolved') ASC,
      CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      created_at DESC
    LIMIT 500`;
  return db.prepare(sql).all(...args) as unknown as Incident[];
}

export function getStats() {
  const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  const byCat = db.prepare("SELECT category, COUNT(*) AS n FROM incidents GROUP BY category").all() as {
    category: string; n: number;
  }[];
  const teamsTotal = one("SELECT COUNT(*) AS n FROM teams");
  const teamsBusy = one("SELECT COUNT(DISTINCT team_id) AS n FROM incidents WHERE team_id IS NOT NULL AND status != 'resolved'");
  return {
    total: one("SELECT COUNT(*) AS n FROM incidents"),
    critical: one("SELECT COUNT(*) AS n FROM incidents WHERE severity = 'critical' AND status != 'resolved'"),
    pending: one("SELECT COUNT(*) AS n FROM incidents WHERE status != 'resolved'"),
    resolved: one("SELECT COUNT(*) AS n FROM incidents WHERE status = 'resolved'"),
    // Incidents with a team on them (Assigned or In Progress).
    assigned: one("SELECT COUNT(*) AS n FROM incidents WHERE team_id IS NOT NULL AND status != 'resolved'"),
    teamsTotal,
    teamsBusy,
    teamsFree: teamsTotal - teamsBusy,
    byCategory: CATEGORIES.map((c) => ({ ...c, n: byCat.find((b) => b.category === c.id)?.n ?? 0 })),
  };
}

/** Data for the analytics charts on the Reports page. */
export function getAnalytics(now = Date.now()) {
  const byStatus = countByStatus();
  const sevRows = db.prepare("SELECT severity, COUNT(*) AS n FROM incidents WHERE status != 'resolved' GROUP BY severity").all() as { severity: string; n: number }[];
  const since = new Date(now - 24 * 3600_000).toISOString();
  const recent = (db.prepare("SELECT created_at FROM incidents WHERE created_at >= ?").all(since) as { created_at: string }[]).map((r) => r.created_at);
  const assigned = db.prepare("SELECT created_at AS 'from', assigned_at AS 'to' FROM incidents WHERE assigned_at IS NOT NULL").all() as { from: string; to: string }[];
  return {
    byStatus: STATUSES.map((st) => ({ ...st, n: byStatus[st.id] ?? 0 })),
    openBySeverity: [...SEVERITIES].reverse().map((sv) => ({ id: sv, n: sevRows.find((r) => r.severity === sv)?.n ?? 0 })),
    hourly: hourlyBuckets(recent, now),
    avgAssignMin: averageMinutes(assigned),
  };
}

export function updateStatus(id: number, status: Status) {
  db.prepare("UPDATE incidents SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(status, id);
}

export function updateSeverity(id: number, severity: Severity) {
  db.prepare("UPDATE incidents SET severity = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(severity, id);
}

export function deleteIncident(id: number) {
  const inc = getIncident(id);
  if (!inc) return;
  db.prepare("DELETE FROM incidents WHERE id = ?").run(id);
  if (inc.photo_file) fs.rmSync(/*turbopackIgnore: true*/ path.join(UPLOAD_DIR, inc.photo_file), { force: true });
}

export function setAiStatus(id: number, status: Incident["ai_status"]) {
  db.prepare("UPDATE incidents SET ai_status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(status, id);
}

/** Save AI result. AI can raise severity (safer) but never lowers the rule result. */
export function saveAiResult(id: number, r: AiResult) {
  const inc = getIncident(id);
  if (!inc) return;
  const raised = severityRank(r.severity) > severityRank(inc.severity) ? r.severity : inc.severity;
  db.prepare(
    `UPDATE incidents SET ai_status = 'done', ai_category = ?, ai_severity = ?, ai_summary = ?, ai_reason = ?,
       ai_confidence = ?, severity = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
  ).run(r.category, r.severity, r.summary, r.reason, Math.round(r.confidence), raised, id);
}

/** AI jobs live in memory; one "busy" for 3+ minutes (e.g. after a server restart) can be retried. */
export function aiIsStale(inc: Pick<Incident, "ai_status" | "updated_at">, now = Date.now()): boolean {
  const busy = inc.ai_status === "queued" || inc.ai_status === "running";
  return busy && now - new Date(inc.updated_at).getTime() > 3 * 60 * 1000;
}

/** Priority queue: open incidents ranked by priority score (see priority.ts). */
export function listQueue(now = Date.now()): (Incident & { priority: Priority })[] {
  const rows = db.prepare(`SELECT i.*, t.name AS team_name FROM incidents i LEFT JOIN teams t ON t.id = i.team_id
    WHERE i.status != 'resolved' LIMIT 500`).all() as unknown as Incident[];
  return rankByPriority(rows, now);
}

export function countByStatus(): Record<string, number> {
  const rows = db.prepare("SELECT status, COUNT(*) AS n FROM incidents GROUP BY status").all() as { status: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

// ---------- Teams / dispatch ----------
export interface Team {
  id: number; name: string; kind: TeamKind; area: string; lat: number; lng: number; phone: string;
  busyWith: number | null;
  track_token: string;
  // Last position sent by the vehicle (null until its phone/GPS unit reports)
  live_lat: number | null; live_lng: number | null; live_accuracy: number | null; live_speed: number | null; live_heading: number | null; live_at: string | null;
  // Current job (when working)
  jobTitle?: string | null; jobLocation?: string | null; jobStatus?: Status | null; jobSeverity?: Severity | null; jobAssignedAt?: string | null;
}

/** All teams with the open incident they are on (a team is busy while its incident isn't resolved). */
export function listTeams(): Team[] {
  return db.prepare(`SELECT t.*, i.id AS busyWith, i.title AS jobTitle, i.location AS jobLocation, i.status AS jobStatus,
      i.severity AS jobSeverity, i.assigned_at AS jobAssignedAt
    FROM teams t
    LEFT JOIN incidents i ON i.id = (SELECT x.id FROM incidents x WHERE x.team_id = t.id AND x.status != 'resolved' LIMIT 1)
    ORDER BY (i.id IS NULL), t.kind, t.name`).all() as unknown as Team[];
}

export const getTeam = (id: number) => listTeams().find((t) => t.id === id);

// ---------- Live tracking ----------
export interface TrackedTeam extends Team { job: { id: number; title: string; location: string; lat: number | null; lng: number | null; status: Status } | null }

/** The team a tracking token belongs to, with its current job (for the crew's /track page and /api/track). */
export function getTeamByToken(token: string): TrackedTeam | undefined {
  if (!token || token.length < 20) return undefined;
  const row = db.prepare("SELECT id FROM teams WHERE track_token = ?").get(token) as { id: number } | undefined;
  const team = row ? getTeam(row.id) : undefined;
  if (!team) return undefined;
  const job = team.busyWith != null ? getIncident(team.busyWith) : undefined;
  return { ...team, job: job ? { id: job.id, title: job.title, location: job.location, lat: job.lat, lng: job.lng, status: job.status } : null };
}

/** Store a GPS fix from the vehicle (already validated and accepted). */
export function saveTeamFix(teamId: number, fix: Fix, atMs: number) {
  db.prepare(`UPDATE teams SET live_lat = ?, live_lng = ?, live_accuracy = ?, live_speed = ?, live_heading = ?, live_at = ? WHERE id = ?`)
    .run(fix.lat, fix.lng, fix.accuracy ?? null, fix.speed ?? null, fix.heading ?? null, new Date(atMs).toISOString(), teamId);
}

/** New tracking token: the old link stops working at once. */
export function regenerateTrackToken(teamId: number) {
  db.prepare("UPDATE teams SET track_token = ?, live_lat = NULL, live_lng = NULL, live_at = NULL WHERE id = ?").run(newTrackToken(), teamId);
}

/** Latest positions for the admin map (polled every few seconds). */
export function listLivePositions() {
  return (db.prepare(`SELECT id, live_lat AS lat, live_lng AS lng, live_accuracy AS accuracy, live_speed AS speed, live_heading AS heading, live_at AS at
    FROM teams WHERE live_at IS NOT NULL`).all() as { id: number; lat: number; lng: number; accuracy: number | null; speed: number | null; heading: number | null; at: string }[])
    .map((r) => ({ ...r }));
}

/** Create a team. Returns an error message or null. */
export function createTeam(t: TeamInput): string | null {
  try {
    db.prepare("INSERT INTO teams (name, kind, area, lat, lng, phone, track_token) VALUES (?, ?, ?, ?, ?, ?, ?)").run(t.name, t.kind, t.area, t.lat, t.lng, t.phone, newTrackToken());
    return null;
  } catch (e) {
    return String(e).includes("UNIQUE") ? `A team named "${t.name}" already exists.` : "Could not save the team.";
  }
}

/** Edit a team (its location is where the team is now). Returns an error message or null. */
export function updateTeam(id: number, t: TeamInput): string | null {
  try {
    const r = db.prepare("UPDATE teams SET name = ?, kind = ?, area = ?, lat = ?, lng = ?, phone = ? WHERE id = ?")
      .run(t.name, t.kind, t.area, t.lat, t.lng, t.phone, id);
    return r.changes ? null : "Team not found.";
  } catch (e) {
    return String(e).includes("UNIQUE") ? `A team named "${t.name}" already exists.` : "Could not save the team.";
  }
}

/** Delete a free team. Busy teams cannot be deleted. Returns an error message or null. */
export function deleteTeam(id: number): string | null {
  const team = getTeam(id);
  if (!team) return "Team not found.";
  if (team.busyWith != null) return `${team.name} is busy on incident #${team.busyWith}. Unassign it first.`;
  db.prepare("UPDATE incidents SET team_id = NULL WHERE team_id = ?").run(id); // only resolved incidents can still point here
  db.prepare("DELETE FROM teams WHERE id = ?").run(id);
  return null;
}

/** Assign a free team. Moves Reported/Pending incidents to Assigned. Returns an error message or null. */
export function assignTeam(incidentId: number, teamId: number): string | null {
  const team = getTeam(teamId);
  if (!team) return "Team not found.";
  if (team.busyWith != null && team.busyWith !== incidentId) return `${team.name} is busy on incident #${team.busyWith}.`;
  db.prepare(`UPDATE incidents SET team_id = ?, assigned_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
      status = CASE WHEN status IN ('reported','pending') THEN 'assigned' ELSE status END,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(teamId, incidentId);
  return null;
}

export function unassignTeam(incidentId: number) {
  db.prepare(`UPDATE incidents SET team_id = NULL, assigned_at = NULL,
      status = CASE WHEN status IN ('assigned','in_progress') THEN 'pending' ELSE status END,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(incidentId);
}

/** Mark an incident as seen by an admin (clears the "New" badge). */
export function markSeen(id: number) {
  db.prepare("UPDATE incidents SET seen_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND seen_at IS NULL").run(id);
}

export const countUnseen = () => (db.prepare("SELECT COUNT(*) AS n FROM incidents WHERE seen_at IS NULL").get() as { n: number }).n;
