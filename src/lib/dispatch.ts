import type { Category } from "./constants.ts";

export const TEAM_KIND_IDS = ["fire", "medical", "police", "rescue", "flood"] as const;
export type TeamKind = (typeof TEAM_KIND_IDS)[number];

export const TEAM_KINDS: Record<TeamKind, string> = {
  fire: "Fire & Rescue",
  medical: "Ambulance",
  police: "Police",
  rescue: "Disaster Rescue",
  flood: "Flood / Boat Rescue",
};

/** Which team types fit each emergency, best first. */
export const SKILLS: Record<Category, TeamKind[]> = {
  fire: ["fire", "rescue", "medical"],
  road_accident: ["medical", "police", "rescue"],
  medical: ["medical"],
  flood: ["flood", "rescue", "medical"],
  building_collapse: ["rescue", "fire", "medical"],
  other: ["police", "rescue"],
};

export interface TeamLike { id: number; kind: TeamKind; lat: number; lng: number; busyWith: number | null }

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface Ranked<T> { team: T; skillRank: number; km: number | null; recommended: boolean }

/**
 * Rank teams for an incident: free teams first, then best skill match, then nearest (if the incident has GPS).
 * The top free team with a matching skill is marked recommended.
 */
export function rankTeams<T extends TeamLike>(teams: T[], incident: { category: Category; lat: number | null; lng: number | null }): Ranked<T>[] {
  const skills = SKILLS[incident.category];
  const hasGps = incident.lat != null && incident.lng != null;
  const ranked = teams.map((team) => {
    const i = skills.indexOf(team.kind);
    return {
      team,
      skillRank: i < 0 ? skills.length : i,
      km: hasGps ? distanceKm({ lat: incident.lat!, lng: incident.lng! }, team) : null,
      recommended: false,
    };
  });
  ranked.sort((a, b) =>
    Number(a.team.busyWith != null) - Number(b.team.busyWith != null) ||
    a.skillRank - b.skillRank ||
    (a.km ?? 0) - (b.km ?? 0));
  const best = ranked.find((r) => r.team.busyWith == null && r.skillRank < skills.length);
  if (best) best.recommended = true;
  return ranked;
}
