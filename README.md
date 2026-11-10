# ResQure — Emergency Response & Disaster Management Platform

CODE CLASH 2026 · Round 1. A web platform where anyone can report an emergency, and administrators monitor, classify and manage incidents from a control-center dashboard.

## Features (Round 1)

**Citizen side** (`/`), with no link or route to admin:
- Report form: category (Fire, Road Accident, Medical, Flood, Building Collapse, Other), description with **voice input**, optional title, location with **GPS → street address**, people-affected counter, optional photo, optional contact.
- Tracking page (`/report/<code>`) with live status: Reported → Pending → In Progress → Resolved.
- Quick-call buttons for 112 / 108 / 101.

**Admin side** (`/admin`, sign-in required):
- **Queue:** open incidents, most severe first, then longest waiting; live map of incidents; key counts.
- **Map:** all open incidents on a CARTO Voyager map.
- **Reports:** total / critical / pending / resolved, incidents by category, and the full searchable incident log with filters.
- **Incident page:** full details, map, photo, AI analysis, status update, severity override, delete (for test or duplicate reports).

**Severity:** a rule-based classifier (category + people affected + danger words) sets Low / Medium / High / Critical instantly. **Claude (headless)** then reads the report and photo in the background and may raise the severity. It never lowers it, and its reply must pass a strict schema check.

## Tech

Next.js 16 (App Router) · TypeScript · Node 24 built-in SQLite · Zod · MapLibre GL + CARTO Voyager · Claude Code headless CLI · OpenStreetMap Nominatim (address lookup).

## Run it

Needs Node 24+. For AI, the `claude` CLI must be installed and signed in.

```bash
npm install
cp .env.example .env   # then fill in ADMIN_PASSWORD, SESSION_SECRET, NEXT_PUBLIC_CARTO_KEY
npm run dev            # http://localhost:3000  (admin: http://localhost:3000/admin)
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Unit tests (severity rules, validation, AI reply parsing, address) |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |

## Project structure

```
src/app/page.tsx, ReportForm.tsx, actions.ts   Citizen report form + server action
src/app/report/[code]/                         Citizen tracking page
src/app/admin/login/                           Admin sign-in
src/app/admin/(panel)/                         Admin shell: queue, map, reports, incidents/[id]
src/app/api/geocode/                           GPS → address (Nominatim, cached, rate-limited)
src/lib/                                       DB, severity rules, validation, auth, AI prompt
scripts/ai-worker.ts                           Detached background worker that runs Claude headless
design/admin-dashboard.html                    Original UI design prototype
```

## Security notes

- Admin password and session secret live in `.env` (git-ignored). Sessions use signed, httpOnly cookies. Login attempts are throttled.
- Uploaded photos: images only (checked by file bytes), 5 MB max, renamed on save, served only to admins.
- Claude runs with only the Read tool, inside the uploads folder. Reporter text is fenced as data.
- Citizen tracking codes are random, so other people's reports can't be guessed.
