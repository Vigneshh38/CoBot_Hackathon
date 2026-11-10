"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  checkCredentials, clearLoginFailures, createSession, destroySession, loginBlocked, recordLoginFailure, requireAdmin,
} from "@/lib/auth";
import { assignTeam, createTeam, deleteIncident, deleteTeam, regenerateTrackToken, updateTeam, getIncident, getTeam, unassignTeam, updateSeverity, updateStatus } from "@/lib/incidents";
import { notifyReporter } from "@/lib/notify";
import { queueAnalysis } from "@/lib/ai";
import { severitySchema, statusSchema, teamSchema } from "@/lib/validation";

export async function login(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (loginBlocked(ip)) return { error: "Too many attempts. Try again in 10 minutes." };
  const ok = checkCredentials(String(form.get("username") ?? ""), String(form.get("password") ?? ""));
  if (!ok) {
    recordLoginFailure(ip);
    return { error: "Wrong username or password." };
  }
  clearLoginFailures(ip);
  await createSession();
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

const idOf = (form: FormData) => {
  const id = Number(form.get("id"));
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid incident id");
  return id;
};

export async function setStatus(form: FormData) {
  await requireAdmin();
  const id = idOf(form);
  const before = getIncident(id);
  const status = statusSchema.parse(form.get("status"));
  updateStatus(id, status);
  const after = getIncident(id);
  if (before && after && before.status !== status) {
    if (status === "in_progress") await notifyReporter(after, "processing", after.team_id ? getTeam(after.team_id)?.name : null);
    if (status === "resolved") await notifyReporter(after, "completed");
  }
  revalidatePath("/admin");
  revalidatePath(`/admin/incidents/${id}`);
}

export async function setSeverity(form: FormData) {
  await requireAdmin();
  const id = idOf(form);
  updateSeverity(id, severitySchema.parse(form.get("severity")));
  revalidatePath("/admin");
  revalidatePath(`/admin/incidents/${id}`);
}

export async function removeIncident(form: FormData) {
  await requireAdmin();
  deleteIncident(idOf(form));
  revalidatePath("/admin");
  redirect("/admin?deleted=1");
}

export async function retryAi(form: FormData) {
  await requireAdmin();
  const id = idOf(form);
  queueAnalysis(id);
  revalidatePath(`/admin/incidents/${id}`);
}

export async function assignTeamAction(form: FormData) {
  await requireAdmin();
  const id = idOf(form);
  const teamId = Number(form.get("teamId"));
  if (!Number.isInteger(teamId) || teamId <= 0) throw new Error("Invalid team");
  const before = getIncident(id);
  const err = assignTeam(id, teamId);
  const after = getIncident(id);
  if (!err && after && before?.status !== after.status && after.status === "assigned") {
    await notifyReporter(after, "processing", getTeam(teamId)?.name);
  }
  if (err) redirect(`/admin/incidents/${id}?assignError=${encodeURIComponent(err)}`);
  revalidatePath("/admin");
  revalidatePath(`/admin/incidents/${id}`);
  redirect(`/admin/incidents/${id}`);
}

export async function unassignTeamAction(form: FormData) {
  await requireAdmin();
  const id = idOf(form);
  unassignTeam(id);
  revalidatePath("/admin");
  revalidatePath(`/admin/incidents/${id}`);
}

export type TeamFormState = { error?: string; ok?: number };

/** Add (no id) or edit (with id) a response team. */
export async function saveTeamAction(_prev: TeamFormState, form: FormData): Promise<TeamFormState> {
  await requireAdmin();
  const parsed = teamSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the team details." };
  const id = Number(form.get("id"));
  const err = Number.isInteger(id) && id > 0 ? updateTeam(id, parsed.data) : createTeam(parsed.data);
  if (err) return { error: err };
  revalidatePath("/admin/teams");
  return { ok: Date.now() };
}

export async function deleteTeamAction(form: FormData) {
  await requireAdmin();
  const err = deleteTeam(idOf(form));
  revalidatePath("/admin/teams");
  redirect(err ? `/admin/teams?error=${encodeURIComponent(err)}` : "/admin/teams?deleted=1");
}

/** Delete several free teams at once (busy ones are skipped and reported). */
export async function deleteTeamsAction(form: FormData) {
  await requireAdmin();
  const ids = form.getAll("ids").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const errors = ids.map((id) => deleteTeam(id)).filter((e): e is string => e != null);
  revalidatePath("/admin/teams");
  const done = ids.length - errors.length;
  redirect(errors.length ? `/admin/teams?deleted=${done}&error=${encodeURIComponent(errors.join(" "))}` : `/admin/teams?deleted=${done}`);
}

/** Replace a team's tracking link (the old link stops working at once). */
export async function regenerateTrackTokenAction(form: FormData) {
  await requireAdmin();
  regenerateTrackToken(idOf(form));
  revalidatePath("/admin/teams");
}
