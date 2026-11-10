import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "admin_session";
const MAX_AGE_S = 8 * 60 * 60;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set in .env (32+ characters).");
  return s;
}
const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkCredentials(username: string, password: string): boolean {
  const u = process.env.ADMIN_USERNAME, p = process.env.ADMIN_PASSWORD;
  if (!u || !p) return false;
  // Evaluate both so timing does not reveal which one was wrong.
  const okU = safeEqual(username, u), okP = safeEqual(password, p);
  return okU && okP;
}

export async function createSession() {
  const exp = Date.now() + MAX_AGE_S * 1000;
  const payload = `admin.${exp}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE_S,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const i = v.lastIndexOf(".");
  const payload = v.slice(0, i), sig = v.slice(i + 1);
  if (!payload || !safeEqual(sig, sign(payload))) return false;
  const exp = Number(payload.split(".")[1]);
  return Number.isFinite(exp) && exp > Date.now();
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

// Simple in-memory login throttle: 5 failed tries per 10 minutes per key.
const attempts = new Map<string, { n: number; until: number }>();
export function loginBlocked(key: string): boolean {
  const a = attempts.get(key);
  return !!a && a.n >= 5 && a.until > Date.now();
}
export function recordLoginFailure(key: string) {
  const a = attempts.get(key);
  const fresh = !a || a.until < Date.now();
  attempts.set(key, { n: fresh ? 1 : a!.n + 1, until: Date.now() + 10 * 60 * 1000 });
}
export function clearLoginFailures(key: string) {
  attempts.delete(key);
}
