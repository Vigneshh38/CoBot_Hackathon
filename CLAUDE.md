# CoBot Hackathon — ResQure

This file guides Claude Code in this repo. Keep it current: update it whenever the stack, structure, commands or decisions change.

## Project

- **Hackathon:** CODE CLASH 2026 (OreHack / CoBot-EX). Submitted via GitHub repo link, default branch `main`.
- **Judging:** Live automated code inspection of the repo + jury evaluation. Code quality, tests, README and structure all count.
- **Challenge (common for all teams):** *Emergency Response & Disaster Management Platform.* Build a web-based platform that helps users report emergency incidents and enables administrators to monitor incidents, prioritise emergencies, and coordinate response operations.
- **Round 1 (60 min, 35 marks) — build exactly this first:** report form (title, description, category, location, number of people affected, optional contact); categories Fire, Road Accident, Medical, Flood, Building Collapse, Other; severity Low/Medium/High/Critical by a simple logical rule from the report; reports stored in a DB; admin dashboard with total, critical, pending, resolved and incidents-by-category; admin can view all, open details, update status (Reported / Pending / In Progress / Resolved) and delete test/duplicate reports; critical incidents visually highlighted; professional, responsive UI. Everything below is for later rounds.
- **Our angle / features (agreed so far, mostly later rounds):**
  - Mobile-first PWA (works as a phone app, no app store); strong focus on road emergencies.
  - Maps: **MapLibre GL JS + CARTO Voyager** vector style `https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json?key=<KEY>`. CARTO now needs a free key (requested at carto.com/basemaps/apikey, emailed, no account) stored in `.env` as `CARTO_BASEMAPS_KEY` (browser-visible, not secret). **No key → fall back to OpenFreeMap** (`https://tiles.openfreemap.org/styles/liberty`, no key). Keep the attribution the style adds. GPS via browser Geolocation API.
  - Citizen flow: open site → big **SOS** button (one tap, sends saved name/phone + GPS) or **Report Incident** form. Name/phone autofilled (saved on device after first use), location autofilled from GPS + address, photo optional.
  - Report form has an optional short **Cause** field ("What happened?"). If empty, AI fills it from the photo (tagged "AI filled").
  - AI image analysis runs in the background after the report is saved (never blocks SOS); returns type, cause, severity, confidence, reason. Admin confirms/corrects. Low confidence → "Needs review".
  - **AI setup: Claude Code headless CLI** (`claude -p ... --output-format json`) called from the backend. Hidden behind an `AiProvider` interface so it can be swapped (e.g. Claude API) later. Security: only the Read tool allowed (`--allowedTools Read`), run in a folder that holds just the photo; response must match a strict JSON schema, else ignored; AI never auto-rejects. Needs Claude Code installed and signed in on the machine running the backend, so the backend runs on the laptop for the demo; phones reach it through an HTTPS tunnel (GPS needs HTTPS). Always keep the rule-based fallback.
  - **AI job queue:** photos are analyzed one at a time from a queue (respects free-tier rate limits); reports are saved instantly regardless.
  - Reporter details: **Name** and **Phone** fields on every report (autofilled from device after first use, editable).
  - **OTP phone verification:** required for normal reports; SOS skips it (speed first) but flags "unverified". A verified phone is remembered on the device so OTP is asked only once. Demo mode shows the OTP on screen / server log (no SMS provider or key needed); real SMS provider can be plugged in later.
  - Priority = severity from cause (user text + AI image; if they disagree, use the higher severity and flag for admin) + nearby report count bonus (capped, diminishing) + injury bonus + waiting-time bonus. Dashboard shows the reason for each rank.
  - Incident statuses: Reported → Verified → Assigned → In Progress → Resolved → Closed.
  - **Location fallback:** if GPS is denied/unavailable, the user drops a pin on the map (or searches an address).
  - **Admin:** single admin account with full access. Credentials come from `.env` (`ADMIN_USERNAME`, `ADMIN_PASSWORD`), never hardcoded; `.env.example` holds placeholders. No separate responder logins: admin assigns response teams (stored as data) and updates status.
  - **Response teams:** each team gets a private link (secret token, no login) showing its assigned task on a map with directions; buttons Accept → On the way → Reached → Resolved update the admin dashboard live.
  - **Disaster features:** incident types include floods, cyclones, earthquakes, landslides etc.; admin can draw an area on the map and send an **area alert** to users there; dashboard has an incident **heatmap**. Shelters/resources only if time allows.
  - **SMS:** sent on receipt ("Report #N received") and on resolve (acknowledgement); OTP uses the same channel. One `SmsProvider` interface: real free-tier provider used when its keys are in `.env` (provider to be confirmed when building; Twilio trial is the likely pick), otherwise fallback prints the SMS/OTP in the server terminal.
  - **SOS repeat rule (built, replaces the old one-per-day idea):** a repeat SOS within `SOS_COOLDOWN_MIN` (default 10) from the same phone or device re-alerts the open SOS incident (max once a minute) instead of creating a new one. The tap-to-call 112/108 buttons are always shown.
  - **Security/privacy:** admin password stored hashed, login attempts rate-limited, httpOnly secure session cookie; phone numbers never shown publicly; short privacy notice on the report form. Deadline times are configurable targets, not official standards.
  - **Demo safety for AI:** warm-up call before the demo, "AI analyzing…" state in the UI, rule-based fallback, and a recorded backup demo video.
  - **SOS repeat matching:** by phone number **and** by a device ID saved on the phone (localStorage).
  - **Area alerts delivery:** shown as an alert banner when anyone opens the website (no accounts needed); users inside the zone see it highlighted.
  - **Photo uploads:** images only, max 5 MB, files renamed on save, never executed or trusted.
  - **Team links:** long random token, admin can revoke/regenerate, expires when the incident is closed.
  - **Admin alerts:** sound + browser notification for new Critical or escalated incidents.
  - **Location accuracy:** approximate GPS is accepted; accuracy (±m) is shown to the admin only.
  - **Build order (tiers):** 1) core loop: report → queue → assign → resolve; 2) AI analysis; 3) SMS + OTP; 4) disaster features (area alerts, heatmap); 5) polish (README, demo data, screenshots). Each tier validated before the next.
  - **Duplicates:** a new report near an open incident (within ~500 m, within 60 min, same/similar cause) is shown to the admin as "Possible duplicate of #N". Admin approves merge (report attaches to the incident, count goes up) or keeps it separate. Never auto-merge.

## Admin UI design rules

Reference prototype: `design/admin-dashboard.html` (static HTML + sample data, open in a browser). Port it to the real app; keep these rules.

- **Style:** calm, standard "Google-style" product UI. Consistent spacing (8px grid), one font (Inter), 12–16px radius, soft warm shadows, no gradients or loud colour blocks.
- **Colours:** sandalwood + white. Tokens live in `:root` (`--bg`, `--surface`, `--sand-*`, `--ink-*`, `--line`). Colour is used only for meaning: severity (critical / high / medium / low) and deadline state (on track / near / breached), always as small chips, dots or bars.
- **Icons:** our own inline SVG icon set (24px, 1.8 stroke, round caps). No icon libraries or emoji.
- **Motion:** 200–300ms with `cubic-bezier(.2,0,0,1)`; queue reorders animate smoothly (FLIP), new incidents slide in, drawer slides from the right. Respect `prefers-reduced-motion`.
- **Layout:** left nav rail · top bar (search, live status, alerts, admin) · KPI row · **priority queue** (main) · live map + team availability · incident detail drawer.
- **Analysis wording:** admin UI never says "AI" or "Claude"; the section is just "Analysis". Confidence is not a row: it shows as a filled ring when hovering the small info icon (`ConfidenceInfo`) at the top right of each incident (queue, reports log, incident page).
- **Removed from the reference image** (not needed for operations): weekly line chart, big colourful stat cards, profile photo, helpline footer.

## Priority queue and deadline (SLA) algorithm

Admin-only. Lives in one pure, unit-tested module.

- **Deadlines per severity** (from report time):

  | Severity | Respond by (assign a team) | Resolve by |
  |---|---|---|
  | Critical | 5 min | 60 min |
  | High | 15 min | 2 h |
  | Medium | 30 min | 4 h |
  | Low | 60 min | 8 h |

- **Score** = severity base (Critical 100, High 70, Medium 40, Low 10)
  + report bonus `min(20, 8 × log2(reports))` (1→0, 2→8, 4→16, 8+→20)
  + injury bonus 15 (injured/trapped from cause text or AI)
  + aging bonus `min(30, 30 × elapsed / respond-by window)` (grows to 30 as the deadline nears, so nothing starves).
- **Queue order:** score high → low; ties broken by earliest deadline. Recomputed every minute and on every change.
- **Deadline badge:** green = on track, amber = under 25% time left, red = breached.
- **Escalation:** when respond-by is breached and no team is assigned, severity goes up one level (once), and the card shows "Escalated: deadline missed".
- Dashboard shows the reason for each score, e.g. "Critical 100 + 4 reports 16 + injury 15 + waiting 12".
- SOS reports are never penalised for being unverified.
- **Repo:** https://github.com/Vigneshh38/CoBot_Hackathon (branch `main`)
- **Status:** Round 1 app built and running locally (2026-11-10). Round 2 features built (2026-11-10). SOS + nearby push alerts + installable SOS app built (2026-11-10). Not committed yet.

## Tech stack

Next.js 16 App Router (classic caching, no Cache Components) · TypeScript · Node 24 built-in `node:sqlite` (file `data/app.db`) · Zod · MapLibre GL **4.7.1** (v6's separate worker file breaks under Turbopack) + CARTO Voyager · Claude Code headless CLI (`--model haiku`) · Nominatim reverse geocoding · `web-push` (VAPID browser push) · PWA manifest + service worker (`public/sw.js`) · Twilio REST for SMS (optional, via fetch). Tests use Node's built-in runner (`node --test`), not Vitest.

Next 16 note: read `node_modules/next/dist/docs/` before using unfamiliar APIs (see AGENTS.md).

## Project structure

- `src/app/` citizen side: `page.tsx` + `ReportForm.tsx` + `actions.ts` (report), `report/[code]` (tracking). **No links to admin.**
- `src/app/admin/login` sign-in; `src/app/admin/(panel)/` admin shell with side rail: `/admin` queue + map, `/admin/map`, `/admin/reports` (stats, by-category, full log), `/admin/incidents/[id]`. `admin/actions.ts` = server actions (each calls `requireAdmin`).
- `src/app/api/geocode` GPS → short address (Nominatim, cached, 1 req/s).
- **SOS + nearby alerts:**
  - `src/app/sos` the installed SOS app screen (hold-to-send button only, plus "Call 112"). Home page has no SOS button; `InstallSos` ("Add SOS to phone", top right) installs the PWA.
  - `src/app/manifest.ts` PWA manifest: `start_url /sos`, name "ResQure SOS", red SOS icons in `public/app/`.
  - `src/app/alert/[code]` full-screen red page a nearby person opens from the notification (directions, "I'm going to help", siren). No name/phone shown; closes when resolved or after 6 h.
  - `public/sw.js` service worker (registered on every visit by `RegisterSW`): caches `/sos` + the `/_next/static` files its HTML uses (cache `resqure-sos-v1`) so the SOS app opens offline; pages are network-first and fall back to the cached `/sos` when offline; `/api` is never cached. Also shows push notifications (`requireInteraction`, vibrate), forwards them to open tabs for the full-screen siren, opens the alert on tap.
  - API: `api/sos` (create SOS or re-alert), `api/push/subscribe` (save subscription + last location; role admin needs admin cookie), `api/push/key` (public VAPID key), `api/alert/[code]/help`, `api/admin/sos` (admin-only list of unseen SOS for the siren).
  - Components: `SosButton` (3 s hold on a plain timer, not animation frames; offline → SMS screen + queued SOS auto-sent on `online`; result screen, "My SOS details" with up to 3 family numbers), `AlertsOptIn` (asks every visit until allowed; warns + "Share my location" when alerts are on but location is missing), `AlertOverlay` (root layout, full-screen siren on push while the site is open), `AdminSosAlarm` (admin layout: polls every 5 s, red banner + siren + browser notification, "Turn on SOS alerts for this device").
  - Lib: `nearby.ts` (pure: pick subscribers within 3 km, max location age 24 h, message text, family SMS text, phone cleanup; tested), `push.ts` (web-push, VAPID keys from `.env` or auto-generated `data/vapid.json`, deletes dead subscriptions), `sms.ts` (Twilio if keys set, else terminal + `data/outbox/`), `siren.ts` (Web Audio siren + vibration), `device.ts` (device id, saved profile, GPS with network fallback, push subscribe).
  - DB: `incidents` gained `is_sos`, `device_id`, `helpers`, `alerted_nearby`, `family_phones`, `last_alert_at`; new table `push_subs` (endpoint, keys, device_id, role citizen/admin, lat, lng, loc_at).
- `src/lib/` `db.ts`, `incidents.ts`, `severity.ts` (rules), `priority.ts` (queue score), `analytics.ts` (chart helpers), `services.ts` (OSM govt services filter), `tracking.ts` (live GPS rules), `validation.ts` (zod + `parseAiReply`), `auth.ts`, `ai.ts` (spawns worker), `ai-prompt.ts`, `address.ts`, `time.ts`, `constants.ts`.
- `scripts/ai-worker.ts` detached AI worker (lock file `data/ai-worker.lock`). It must run outside the request process: Next dev runs requests in short-lived workers, which killed in-process jobs.
- `design/admin-dashboard.html` original static prototype.

## Commands

- `npm run dev` (http://localhost:3000, admin at `/admin`; credentials in `.env`)
- `npm test` · `npm run typecheck` · `npm run lint` · `npm run build`
- `node scripts/ai-worker.ts` processes any queued AI jobs manually.
- `node scripts/fetch-services.ts` refreshes `src/data/chennai-services.json` from OpenStreetMap (Overpass).
- `npm run replay-gps -- "<team name>"` replays a road drive through `/api/track` for demos (stands in for the crew's phone).
- `npm run check:round2` runs the Round 2 data-layer smoke check on a throwaway database.
- `npm run check:sos` runs the SOS data-layer smoke check on a throwaway database (output in `docs/evidence/sos-check.txt`).
- `npm run push:test` sends a test notification to every subscribed phone (ignores location) to prove push delivery.
- Phone testing: `cloudflared tunnel --url http://localhost:3000` gives an HTTPS `*.trycloudflare.com` link (GPS, push and install need HTTPS). The link changes on every restart.

## Conventions

- Dev machine is Windows 11; commands should work in PowerShell or Git Bash.
- Commit only when asked; keep commits small and clear.

## Validation (required for every part)

Each feature or part we build must be validated before it counts as done, so we can show proof in the final presentation.

- Validate with something real and repeatable: an automated test, a script that runs the feature, or a run of the actual app.
- Record every validation in [VALIDATION.md](VALIDATION.md): what was checked, how, the result, and where the evidence is (test file, command output, screenshot in `docs/evidence/`).
- If a check fails, log the failure too, then the fix and the re-check. A fail-then-fix story is good presentation material.
- Never mark a part as validated without actually running the check.

## Decisions log

- 2026-11-10: Repo cloned into `D:\CoBot_Hackathon`; CLAUDE.md created.
- 2026-11-10: Every part must be validated and logged in VALIDATION.md for the presentation.
- 2026-11-10: Challenge received: Emergency Response & Disaster Management Platform (web-based).
- 2026-11-10: Priority is cause/severity-based (user cause or AI from image), boosted by nearby report count, injuries and waiting time.
- 2026-11-10: AI = Claude Code headless CLI for the demo (swappable). OTP added (normal reports; SOS skips). Name + phone on every report.
- 2026-11-10: Priority queue + per-severity deadlines (SLA) with aging and escalation; single admin login from .env; SMS acknowledgement on resolve (demo mode); map pin fallback; duplicates merged only with admin approval.
- 2026-11-10: Design review fixes: team task links, disaster features (area alerts + heatmap), SMS on receipt + resolve with terminal fallback, 1 SOS per phone per day, security/privacy basics, headless AI demo safety.
- 2026-11-10: AI switched from Claude Code headless CLI to **Gemini API** (removes laptop dependency). Added device-ID SOS limit, alerts as site banner, AI queue, upload limits, revocable team links, admin sound alerts, approximate location OK, tiered build order.
- 2026-11-10: AI switched **back to Claude Code headless CLI** (Gemini dropped). Backend runs on laptop + HTTPS tunnel for the demo.
- 2026-11-10: Admin UI design set: sandalwood + white, Google-style standard UI, custom icons, smooth motion. Prototype in `design/admin-dashboard.html`.
- 2026-11-10: Map tiles switched from CARTO (now needs an API key) to OpenFreeMap via MapLibre GL (no key).
- 2026-11-10: Round 1 built: title optional (auto-generated), people counter with quick picks, contact optional, exact 6 categories, rule severity + Claude AI raise-only, statuses Reported/Pending/In Progress/Resolved, delete. Voice input on description; GPS shows street address (coords hidden, stored for map). Citizen and admin fully separate; admin = side-rail shell (Queue, Map, Reports; Teams/Alerts marked coming soon).
- 2026-11-10: Team assignment added (no team login): `teams` table seeded with 8 fictional Chennai units; `src/lib/dispatch.ts` ranks teams (free first → skill match for the category → nearest by GPS) and stars one as recommended. Assigning moves Reported/Pending → In Progress; a team is busy until its incident is Resolved; unassign moves back to Pending. Admin rail now has Teams page.
- 2026-11-10: Map page = full-screen console (`MapConsole`): click a pin → left panel (location, navigate/street view, assigned team + ETA, analysis); right control bar (zoom, fit all, toggle teams/routes, fullscreen). In-progress incidents show the team driving along a real road route (`/api/route`, OSRM demo server, straight-line fallback); position is simulated from time since assignment.
- 2026-11-10: Product name is **ResQure** (was placeholder "Sahaya").
- 2026-11-10: AI worker now calls Claude like D:\ssapp: photo sent inline as base64 via `--input-format stream-json`, `--tools ""`, `--strict-mcp-config`, `--setting-sources project`, `--no-session-persistence`, and ANTHROPIC_*/CLAUDE* env vars stripped (inherited vars from the dev server made spawned runs hang). ~7 s with a photo. Errors go to `data/ai-worker.log`. Long model text is trimmed, not rejected.
- 2026-11-10: Team phones = real public service numbers (108 ambulance, 101 fire, 100 police, 112 ERSS rescue, 1070 TN disaster control room); unit names stay demo. Station-specific numbers are NOT invented. Admin call buttons (`CallButton`) confirm before dialling. Citizen page has 112/108/101/100.
- 2026-11-10: CARTO Voyager back as the main map, using a free CARTO key; OpenFreeMap kept as the no-key fallback.
- 2026-11-10: Logo redesigned (old one too busy): one big white "R" on a sandalwood rounded tile with a health cross inside the R's loop; wordmark "Res" ink + "Qure" sandalwood, no heartbeat line. `src/components/Logo.tsx`, favicon `src/app/icon.svg`.
- 2026-11-10: Round 2 built. Queue ranked by `priority.ts` score = severity base (100/70/40/10) + people (max 15) + waiting (max 30, only while unassigned, full at respond-by 5/15/30/60 min) + category (max 10); score is backend-only (not shown in the UI), it just orders the queue. New status **Assigned** (Reported → Pending → Assigned → In Progress → Resolved): assigning sets Assigned. Teams page is one table with filter + checkboxes + bulk delete, and add/edit/delete (map click sets current location; busy teams can't be deleted). Queue and Reports KPIs add assigned incidents and busy/available teams.
- 2026-11-10: Reports page got an Analytics section (`src/components/Charts.tsx`, plain SVG, no chart library): reports per hour (24 h), team utilisation ring + average time to assign, incidents by status, open incidents by severity. Status bars are one colour (status colours failed the colourblind check). The queue's coloured left bar was replaced by a round rank badge on the card edge, ringed in the severity colour.
- 2026-11-10: Real Chennai government services on the map console: 16 fire stations, 123 police stations, 54 government hospitals from OpenStreetMap (ODbL, attribution shown), saved in `src/data/chennai-services.json` so the demo works offline. No ambulance bases are tagged in OSM, so none are shown; never invent locations. Toggle per type in the map Legend; all on by default.
- 2026-11-10: Citizen pages (report, tracking) and admin sign-in use `Backdrop` (`src/components/Backdrop.tsx`): Chennai skyline photo graded warm + slow drift, moving light, topo lines, location ping, grain; cards become frosted glass (`.on-bd`). CSS-only motion, off under reduced motion. Photo credit (CC BY 4.0) shown via `BackdropCredit`. Admin panel itself stays plain.
- 2026-11-10: Admin panel + admin sign-in background = aerial Chennai photo (`public/bg/chennai-aerial.jpg`, CC BY-SA 4.0) via `<Backdrop variant="admin" />`; rail/cards frosted glass. All backdrop styles live in `src/app/backdrop.css` (not globals.css).
- 2026-11-10: **SOS + nearby alerts built.** One SOS saves a Critical incident (no AI), then alerts by browser push everyone with alerts on whose last location is within 3 km (location under 24 h old; sender excluded), every admin device, and up to 3 family numbers by SMS (demo mode prints to the terminal). Web pages can't notify phones that never opened the site or allowed notifications; area-wide alerts to every phone need government Cell Broadcast (NDMA/C-DOT "Sachet"), out of scope. Browser push can't play a custom sound or go full screen; the loud siren and red full-screen alert play when the site is open or the notification is tapped.
- 2026-11-10: Alerts opt-in is a strong ask on every visit until allowed, never a gate: SOS and the call buttons always work.
- 2026-11-10: SOS moved off the home page into an installable app: "Add SOS to phone" (top right) installs the PWA, whose icon opens `/sos` with one button you **hold for 3 seconds**. Power-button presses can't be detected by a web app; the install sheet suggests Samsung side-button double press → open app, iPhone Back Tap → Shortcut to `/sos`, and the phone's own Emergency SOS.
- 2026-11-10: Phone test found a subscriber with no saved location (GPS denied or timed out indoors), so it was never "nearby". Fixes: GPS falls back to a quick Wi-Fi/cell fix; phones with alerts on but no location get a "Share my location" prompt.
- 2026-11-10: A repeat SOS used to be rejected for 10 min, which blocked re-alerting a friend who subscribed after the first press. Now a repeat press re-alerts nearby people for the same open incident (max once a minute, position updated, no duplicate incident or SMS).
- 2026-11-10: **Offline SOS.** The SOS app opens with no internet (service worker cache). GPS still works offline (satellites). With no connection the SOS screen offers "Send SOS by SMS": it opens the phone's SMS app with a first-person message + Google Maps link to the saved family numbers (+ optional `NEXT_PUBLIC_SOS_SMS_NUMBER` control-room number); the user must tap Send (browsers can't send SMS silently; fully automatic SMS needs a native Android app). The SOS is also queued in localStorage (max 1 h) and sent to the server automatically when the connection returns. A control-room receiving number (Twilio inbound webhook) is optional and not built: ~15 min setup and no Indian Twilio numbers.
- 2026-11-10: Hold-to-send switched from requestAnimationFrame to a 50 ms timer: animation frames pause in hidden/throttled tabs (found in the test browser), which would have made a hold never finish.
- 2026-11-10: Offline SMS wording is its own first-person text (`offlineSmsText`) and never says "the control room has been alerted" (found in testing: the online family-SMS text claimed that while offline).
- 2026-11-10: Vehicle movement is now **real GPS only** (simulated speed removed). Each team has a revocable `track_token`; the crew's phone opens `/track/<token>` (no login) or a GPS unit POSTs to `/api/track` with a Bearer token. The admin map polls `/api/live` (admin only) every 5 s, re-routes from the live position, and shows ETA + GPS age. Live < 60 s, stale < 10 min, otherwise offline (shown at base, "no GPS yet").
