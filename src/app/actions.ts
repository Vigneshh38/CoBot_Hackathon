"use server";

import { redirect } from "next/navigation";
import { reportSchema } from "@/lib/validation.ts";
import { createIncident } from "@/lib/incidents.ts";
import { queueAnalysis } from "@/lib/ai.ts";
import { notifyReporter } from "@/lib/notify.ts";
import { MAX_PHOTO_BYTES, PHOTO_TYPES } from "@/lib/constants.ts";

export interface ReportState {
  errors?: Record<string, string>;
  message?: string;
  values?: Record<string, string>; // echoed back so the form keeps what the user typed
}

/** Check the real file bytes, not just the browser-supplied type. */
function sniffImage(b: Buffer): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

export async function submitReport(_prev: ReportState, form: FormData): Promise<ReportState> {
  const raw = Object.fromEntries(
    ["title", "description", "category", "location", "lat", "lng", "peopleAffected", "contactName", "contactPhone", "contactEmail"]
      .map((k) => [k, form.get(k) ?? undefined])
      .map(([k, v]) => [k, v === "" ? undefined : v]),
  );
  const parsed = reportSchema.safeParse(raw);
  const errors: Record<string, string> = {};
  if (!parsed.success) for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;

  let photo: { bytes: Buffer; ext: string } | undefined;
  const file = form.get("photo");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PHOTO_BYTES) errors.photo = "Photo must be 5 MB or smaller.";
    else if (!PHOTO_TYPES[file.type]) errors.photo = "Photo must be JPG, PNG or WEBP.";
    else {
      const bytes = Buffer.from(await file.arrayBuffer());
      const ext = sniffImage(bytes);
      if (!ext) errors.photo = "That file is not a valid image.";
      else photo = { bytes, ext };
    }
  }

  if (!parsed.success || Object.keys(errors).length) {
    const values = Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "string")) as Record<string, string>;
    return { errors, values, message: "Please fix the highlighted fields." };
  }

  const incident = createIncident(parsed.data, photo);
  queueAnalysis(incident.id);
  await notifyReporter(incident, "received");
  redirect(`/report/${incident.code}`);
}
