import fs from "node:fs";
import path from "node:path";
import { isAdmin } from "@/lib/auth";
import { UPLOAD_DIR } from "@/lib/db";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Serves uploaded photos to signed-in admins only. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const { file } = await params;
  const m = /^([A-F0-9]{10})\.(jpg|png|webp)$/.exec(file); // only our own generated names — blocks path tricks
  if (!m) return new Response("Not found", { status: 404 });
  const full = /*turbopackIgnore: true*/ path.join(UPLOAD_DIR, file);
  if (!fs.existsSync(full)) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(full), {
    headers: { "Content-Type": TYPES[m[2]], "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
