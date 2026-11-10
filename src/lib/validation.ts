import { z } from "zod";
import { CATEGORY_IDS, SEVERITIES, STATUS_IDS } from "./constants.ts";
import { TEAM_KIND_IDS } from "./dispatch.ts";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

export const reportSchema = z.object({
  title: optionalText(120),
  description: z.string().trim().min(5, "Please describe what happened (at least 5 characters).").max(2000),
  category: z.enum(CATEGORY_IDS, { message: "Please choose a category." }),
  location: z.string().trim().min(3, "Please enter the location or use GPS.").max(300),
  lat: z.coerce.number().min(-90).max(90).optional().catch(undefined),
  lng: z.coerce.number().min(-180).max(180).optional().catch(undefined),
  peopleAffected: z.coerce.number().int().min(1, "At least 1 person.").max(100000),
  contactName: optionalText(80),
  contactEmail: optionalText(120).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "Enter a valid email address."),
  contactPhone: z.string({ message: "Phone number is required." }).trim().min(1, "Phone number is required.")
    .regex(/^[+\d][\d\s-]{6,18}$/, "Enter a valid phone number."),
});
export type ReportInput = z.infer<typeof reportSchema>;

export const teamSchema = z.object({
  name: z.string().trim().min(2, "Team name is required.").max(60),
  kind: z.enum(TEAM_KIND_IDS, { message: "Choose a response category." }),
  area: z.string().trim().min(2, "Base area is required.").max(60),
  lat: z.coerce.number({ message: "Set the team location on the map." }).min(-90).max(90),
  lng: z.coerce.number({ message: "Set the team location on the map." }).min(-180).max(180),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{2,18}$/, "Enter a valid phone number."),
});
export type TeamInput = z.infer<typeof teamSchema>;

const deviceId = z.string().regex(/^[A-Za-z0-9-]{8,64}$/, "Bad device id.");
const optLat = z.number().min(-90).max(90).optional().catch(undefined);
const optLng = z.number().min(-180).max(180).optional().catch(undefined);

/** One-tap SOS. Everything except the device id is optional: a person in danger must never be blocked. */
export const sosSchema = z.object({
  deviceId,
  lat: optLat,
  lng: optLng,
  accuracy: z.number().min(0).max(100000).optional().catch(undefined),
  location: optionalText(300).catch(undefined),
  contactName: optionalText(80).catch(undefined),
  contactPhone: z.string().trim().regex(/^[+\d][\d\s-]{6,18}$/).optional().catch(undefined),
  familyPhones: z.unknown().optional(),
});

/** A browser push subscription (from PushManager.subscribe) plus the device's last known location. */
export const pushSubSchema = z.object({
  deviceId,
  role: z.enum(["citizen", "admin"]).default("citizen"),
  subscription: z.object({
    endpoint: z.url({ protocol: /^https$/ }).max(1000),
    keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  }),
  lat: optLat,
  lng: optLng,
});

export const statusSchema = z.enum(STATUS_IDS);
export const severitySchema = z.enum(SEVERITIES);

export const aiResultSchema = z.object({
  category: z.enum(CATEGORY_IDS),
  severity: z.enum(SEVERITIES),
  // Trim long model text instead of rejecting the whole result.
  summary: z.string().trim().min(1).transform((v) => (v.length > 300 ? v.slice(0, 297) + "…" : v)),
  reason: z.string().trim().min(1).transform((v) => (v.length > 400 ? v.slice(0, 397) + "…" : v)),
  confidence: z.number().min(0).max(100),
});
export type AiResult = z.infer<typeof aiResultSchema>;

/** Pull the first JSON object out of a model reply and validate it; null if anything is off. */
export function parseAiReply(text: string): AiResult | null {
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = aiResultSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
