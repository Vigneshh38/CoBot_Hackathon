export const CATEGORIES = [
  { id: "fire", label: "Fire Emergency" },
  { id: "road_accident", label: "Road Accident" },
  { id: "medical", label: "Medical Emergency" },
  { id: "flood", label: "Flood" },
  { id: "building_collapse", label: "Building Collapse" },
  { id: "other", label: "Other Emergency" },
] as const;

export type Category = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [Category, ...Category[]];
export const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? "Other Emergency";

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const severityLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const severityRank = (s: Severity) => SEVERITIES.indexOf(s);

export const STATUSES = [
  { id: "reported", label: "Reported" },
  { id: "pending", label: "Pending" },
  { id: "assigned", label: "Assigned" },
  { id: "in_progress", label: "In Progress" },
  { id: "resolved", label: "Resolved" },
] as const;
export type Status = (typeof STATUSES)[number]["id"];
export const STATUS_IDS = STATUSES.map((s) => s.id) as [Status, ...Status[]];
export const statusLabel = (id: string) => STATUSES.find((s) => s.id === id)?.label ?? id;

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
