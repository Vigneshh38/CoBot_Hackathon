import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/** Long random token for a team's tracking link (unguessable, URL-safe). */
export const newTrackToken = () => crypto.randomBytes(24).toString("base64url");

export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

function open(): DatabaseSync {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = new DatabaseSync(/*turbopackIgnore: true*/ path.join(DATA_DIR, "app.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS incidents (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      code             TEXT NOT NULL UNIQUE,
      title            TEXT NOT NULL,
      description      TEXT NOT NULL,
      category         TEXT NOT NULL,
      location         TEXT NOT NULL,
      lat              REAL,
      lng              REAL,
      people_affected  INTEGER NOT NULL DEFAULT 1,
      contact_name     TEXT,
      contact_phone    TEXT,
      photo_file       TEXT,
      severity         TEXT NOT NULL,
      rule_severity    TEXT NOT NULL,
      severity_reasons TEXT NOT NULL DEFAULT '[]',
      status           TEXT NOT NULL DEFAULT 'reported',
      ai_status        TEXT NOT NULL DEFAULT 'none',
      ai_category      TEXT,
      ai_severity      TEXT,
      ai_summary       TEXT,
      ai_reason        TEXT,
      ai_confidence    INTEGER,
      created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
    CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
  `);
  return db;
}

// Seed response teams (Chennai): unit names are demo units; phone = the real public number for that service
// (108 ambulance, 101 fire, 100 police, 112 ERSS, 1070 Tamil Nadu disaster control room).
const SEED_TEAMS: [string, string, string, number, number, string][] = [
  ["Ambulance A-07", "medical", "Guindy", 13.0108, 80.2206, "108"],
  ["Ambulance A-12", "medical", "Velachery", 12.9792, 80.2209, "108"],
  ["Ambulance A-21", "medical", "Anna Nagar", 13.0850, 80.2101, "108"],
  ["Fire Unit F-02", "fire", "T. Nagar", 13.0418, 80.2341, "101"],
  ["Fire Unit F-05", "fire", "Egmore", 13.0732, 80.2609, "101"],
  ["Traffic Police TP-11", "police", "Kathipara", 13.0067, 80.2050, "100"],
  ["Rescue Team R-03", "rescue", "Adyar", 13.0067, 80.2570, "112"],
  ["Boat Rescue B-01", "flood", "Saidapet", 13.0213, 80.2231, "1070"],
];

/** Idempotent migrations — run on every module load so dev hot-reloads pick them up. */
function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT NOT NULL UNIQUE,
      kind  TEXT NOT NULL,
      area  TEXT NOT NULL,
      lat   REAL NOT NULL,
      lng   REAL NOT NULL,
      phone TEXT NOT NULL
    );
  `);
  const cols = (db.prepare("PRAGMA table_info(incidents)").all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes("team_id")) db.exec("ALTER TABLE incidents ADD COLUMN team_id INTEGER REFERENCES teams(id)");
  if (!cols.includes("assigned_at")) db.exec("ALTER TABLE incidents ADD COLUMN assigned_at TEXT");
  if (!cols.includes("contact_email")) db.exec("ALTER TABLE incidents ADD COLUMN contact_email TEXT");
  if (!cols.includes("seen_at")) db.exec("ALTER TABLE incidents ADD COLUMN seen_at TEXT"); // null = admin hasn't opened it yet
  // SOS: one-tap alert; device_id enforces the SOS cooldown; helpers = nearby people who said "I'm going".
  if (!cols.includes("is_sos")) db.exec("ALTER TABLE incidents ADD COLUMN is_sos INTEGER NOT NULL DEFAULT 0");
  if (!cols.includes("device_id")) db.exec("ALTER TABLE incidents ADD COLUMN device_id TEXT");
  if (!cols.includes("helpers")) db.exec("ALTER TABLE incidents ADD COLUMN helpers INTEGER NOT NULL DEFAULT 0");
  if (!cols.includes("alerted_nearby")) db.exec("ALTER TABLE incidents ADD COLUMN alerted_nearby INTEGER NOT NULL DEFAULT 0");
  if (!cols.includes("family_phones")) db.exec("ALTER TABLE incidents ADD COLUMN family_phones TEXT");
  if (!cols.includes("last_alert_at")) db.exec("ALTER TABLE incidents ADD COLUMN last_alert_at TEXT"); // last time nearby people were (re)alerted
  // Browser push subscriptions: role 'citizen' (nearby SOS alerts, last known location) or 'admin' (control room).
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint   TEXT NOT NULL UNIQUE,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      device_id  TEXT,
      role       TEXT NOT NULL DEFAULT 'citizen',
      lat        REAL,
      lng        REAL,
      loc_at     TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);
  // Live vehicle tracking: each team has a private token its phone/GPS unit uses to send positions.
  const tcols = (db.prepare("PRAGMA table_info(teams)").all() as { name: string }[]).map((c) => c.name);
  for (const [col, type] of [["track_token", "TEXT"], ["live_lat", "REAL"], ["live_lng", "REAL"], ["live_accuracy", "REAL"],
    ["live_speed", "REAL"], ["live_heading", "REAL"], ["live_at", "TEXT"]] as const) {
    if (!tcols.includes(col)) db.exec(`ALTER TABLE teams ADD COLUMN ${col} ${type}`);
  }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_token ON teams(track_token)");
  // Replace old placeholder numbers with the real public service numbers.
  db.exec(`UPDATE teams SET phone = CASE kind WHEN 'medical' THEN '108' WHEN 'fire' THEN '101' WHEN 'police' THEN '100'
    WHEN 'rescue' THEN '112' WHEN 'flood' THEN '1070' ELSE phone END WHERE phone LIKE '+91 44 2000%'`);
  if ((db.prepare("SELECT COUNT(*) AS n FROM teams").get() as { n: number }).n === 0) {
    const ins = db.prepare("INSERT INTO teams (name, kind, area, lat, lng, phone) VALUES (?, ?, ?, ?, ?, ?)");
    for (const t of SEED_TEAMS) ins.run(...t);
  }
  const noToken = db.prepare("SELECT id FROM teams WHERE track_token IS NULL").all() as { id: number }[];
  const setToken = db.prepare("UPDATE teams SET track_token = ? WHERE id = ?");
  for (const { id } of noToken) setToken.run(newTrackToken(), id);
}

// One connection per server process (survives dev hot reloads).
const g = globalThis as unknown as { __db?: DatabaseSync };
export const db: DatabaseSync = g.__db ?? (g.__db = open());
migrate(db);
