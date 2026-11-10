import type { Category, Severity } from "./constants.ts";

/**
 * Rule-based severity ("basic logical mechanism" from the Round 1 brief).
 * Points from category + people affected + danger words in the text, then mapped to a level.
 * Pure and deterministic, so it is unit-tested and always works even if AI is unavailable.
 */
const CATEGORY_POINTS: Record<Category, number> = {
  building_collapse: 3,
  fire: 2,
  flood: 2,
  road_accident: 1,
  medical: 1,
  other: 0,
};

const CRITICAL_WORDS = [
  "trapped", "unconscious", "not breathing", "no pulse", "explosion", "exploded", "collapsed",
  "burning", "spreading", "drowning", "heavy bleeding", "bleeding heavily", "child", "children", "dead", "died",
];
const SERIOUS_WORDS = [
  "injured", "injury", "bleeding", "smoke", "stranded", "fracture", "broken", "gas leak", "electrocut",
  "fainted", "chest pain", "crash", "overturned", "rising water", "crack",
];

export function peoplePoints(people: number): number {
  if (people >= 21) return 3;
  if (people >= 6) return 2;
  if (people >= 2) return 1;
  return 0;
}

export function pointsToSeverity(points: number): Severity {
  if (points >= 6) return "critical";
  if (points >= 4) return "high";
  if (points >= 2) return "medium";
  return "low";
}

export interface SeverityResult {
  severity: Severity;
  points: number;
  reasons: string[];
}

export function classifySeverity(input: { category: Category; peopleAffected: number; text: string }): SeverityResult {
  const text = input.text.toLowerCase();
  const reasons: string[] = [];
  let points = CATEGORY_POINTS[input.category];
  if (points > 0) reasons.push(`Category risk +${points}`);

  const pp = peoplePoints(input.peopleAffected);
  if (pp > 0) reasons.push(`${input.peopleAffected} people affected +${pp}`);
  points += pp;

  const critical = CRITICAL_WORDS.filter((w) => text.includes(w));
  const serious = SERIOUS_WORDS.filter((w) => text.includes(w) && !critical.some((c) => c.includes(w)));
  if (critical.length) {
    points += 3;
    reasons.push(`Critical signs: ${critical.slice(0, 3).join(", ")} +3`);
  } else if (serious.length) {
    points += 1;
    reasons.push(`Serious signs: ${serious.slice(0, 3).join(", ")} +1`);
  }

  return { severity: pointsToSeverity(points), points, reasons };
}
