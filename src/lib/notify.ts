import "server-only";
import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import { DATA_DIR } from "./db.ts";
import { categoryLabel } from "./constants.ts";
import type { Incident } from "./incidents.ts";

export type MailEvent = "received" | "processing" | "completed";

const COPY: Record<MailEvent, { subject: string; heading: string; body: string }> = {
  received: { subject: "We received your emergency report", heading: "Report received", body: "Your report has reached the ResQure control room. Help is being coordinated." },
  processing: { subject: "Your emergency report is being handled", heading: "Help is on the way", body: "A response team is now handling your report." },
  completed: { subject: "Your emergency report is resolved", heading: "Incident resolved", body: "The incident you reported has been marked as resolved. Thank you for reporting — you helped someone today." },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function render(inc: Incident, ev: MailEvent, teamName?: string | null) {
  const c = COPY[ev];
  const base = (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const link = `${base}/report/${inc.code}`;
  const team = ev === "processing" && teamName ? `<p style="margin:0 0 12px">Assigned team: <b>${esc(teamName)}</b></p>` : "";
  const html = `<div style="font-family:Inter,Arial,sans-serif;background:#faf6f0;padding:24px">
  <div style="max-width:520px;margin:auto;background:#fff;border:1px solid #eae1d3;border-radius:14px;padding:24px;color:#2a241d">
    <div style="font-weight:800;font-size:20px;margin-bottom:16px">Res<span style="color:#9a7650">Qure</span></div>
    <h2 style="margin:0 0 8px;font-size:18px">${c.heading}</h2>
    <p style="margin:0 0 12px;color:#5e554a">${c.body}</p>${team}
    <table style="font-size:14px;margin:12px 0;border-collapse:collapse">
      <tr><td style="color:#8a8073;padding:3px 12px 3px 0">Incident</td><td>${esc(inc.title)}</td></tr>
      <tr><td style="color:#8a8073;padding:3px 12px 3px 0">Category</td><td>${esc(categoryLabel(inc.category))}</td></tr>
      <tr><td style="color:#8a8073;padding:3px 12px 3px 0">Location</td><td>${esc(inc.location)}</td></tr>
      <tr><td style="color:#8a8073;padding:3px 12px 3px 0">Tracking code</td><td><b>${inc.code}</b></td></tr>
    </table>
    <a href="${link}" style="display:inline-block;background:#9a7650;color:#fff;text-decoration:none;padding:10px 18px;border-radius:20px;font-weight:600">Track your report</a>
    <p style="margin:16px 0 0;font-size:12px;color:#8a8073">Still in danger? Call 112.</p>
  </div></div>`;
  const text = `${c.heading}\n\n${c.body}\n${teamName && ev === "processing" ? `Assigned team: ${teamName}\n` : ""}\nIncident: ${inc.title}\nLocation: ${inc.location}\nTracking code: ${inc.code}\nTrack: ${link}\n\nStill in danger? Call 112.`;
  return { subject: `${c.subject} (#${inc.code})`, html, text };
}

/**
 * Email the reporter (only if they gave an email). Uses SMTP from .env; without it, the email is
 * written to data/outbox/ so the flow still works in a demo. Never throws — email must not break reporting.
 */
export async function notifyReporter(inc: Incident, ev: MailEvent, teamName?: string | null) {
  if (!inc.contact_email) return;
  const mail = render(inc, ev, teamName);
  try {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      const port = Number(SMTP_PORT || 465);
      const transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
      await transport.sendMail({ from: MAIL_FROM || `ResQure <${SMTP_USER}>`, to: inc.contact_email, ...mail });
    } else {
      const dir = /*turbopackIgnore: true*/ path.join(DATA_DIR, "outbox");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(/*turbopackIgnore: true*/ path.join(dir, `${Date.now()}-${inc.code}-${ev}.html`),
        `<!-- To: ${esc(inc.contact_email)} | Subject: ${esc(mail.subject)} -->\n${mail.html}`);
    }
  } catch (e) {
    console.error(`[email] ${ev} for ${inc.code} failed:`, (e as Error).message);
  }
}
