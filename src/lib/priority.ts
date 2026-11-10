import type { Category, Severity } from "./constants.ts";

/**
 * Priority score for the admin queue (Round 2 "Intelligent Incident Prioritization").
 * score = severity base + people bonus + waiting bonus + category bonus.
 * Pure and deterministic so it is unit-tested; recomputed on every page load.
 */
export const SEVERITY_BASE: Record<Severity, number> = { critical: 100, high: 70, medium: 40, low: 10 };

/** Minutes within which a team should be assigned; the waiting bonus reaches its max at this point. */
export const RESPOND_BY_MIN: Record<Severity, number> = { critical: 5, high: 15, medium: 30, low: 60 };

export const CATEGORY_BONUS: Record<Category, number> = {
  building_collapse: 10, fire: 8, flood: 6, road_accident: 4, medical: 4, other: 0,
};

export const MAX_PEOPLE_BONUS = 15;
export const MAX_WAIT_BONUS = 30;

/** 1 person → 0, 2 → 5, 4 → 10, 8+ → 15 (diminishing). */
export function peopleBonus(people: number): number {
  if (people <= 1) return 0;
  return Math.min(MAX_PEOPLE_BONUS, Math.round(5 * Math.log2(people)));
}

/** Grows from 0 to 30 as the respond-by window runs out, so nothing waits forever at the bottom. */
export function waitingBonus(severity: Severity, waitedMin: number): number {
  if (waitedMin <= 0) return 0;
  return Math.min(MAX_WAIT_BONUS, Math.round((MAX_WAIT_BONUS * waitedMin) / RESPOND_BY_MIN[severity]));
}

export interface PriorityInput {
  severity: Severity;
  category: Category;
  people_affected: number;
  created_at: string;
  team_id: number | null;
}

export interface Priority { score: number; parts: { label: string; points: number }[]; reason: string }

export function scoreIncident(i: PriorityInput, now = Date.now()): Priority {
  const waitedMin = (now - new Date(i.created_at).getTime()) / 60000;
  const sev = i.severity.charAt(0).toUpperCase() + i.severity.slice(1);
  const parts = [
    { label: sev, points: SEVERITY_BASE[i.severity] },
    { label: `${i.people_affected} ${i.people_affected === 1 ? "person" : "people"}`, points: peopleBonus(i.people_affected) },
    // Waiting only counts while no team is assigned: once a team is on it, the urgency is handled.
    { label: "waiting", points: i.team_id == null ? waitingBonus(i.severity, waitedMin) : 0 },
    { label: "category", points: CATEGORY_BONUS[i.category] },
  ];
  const score = parts.reduce((s, p) => s + p.points, 0);
  const reason = parts.filter((p, idx) => idx === 0 || p.points > 0).map((p) => `${p.label} ${p.points}`).join(" + ");
  return { score, parts, reason };
}

/** Highest score first; ties go to whoever reported first. */
export function rankByPriority<T extends PriorityInput>(items: T[], now = Date.now()): (T & { priority: Priority })[] {
  return items
    .map((i) => ({ ...i, priority: scoreIncident(i, now) }))
    .sort((a, b) => b.priority.score - a.priority.score || a.created_at.localeCompare(b.created_at));
}
