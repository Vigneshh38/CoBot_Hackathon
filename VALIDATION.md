# Validation Log

This file is proof that each part of the project works. It feeds the hackathon presentation.

Each entry has: the part, what we checked, how we checked it, the result, and the evidence.
Screenshots and saved outputs go in `docs/evidence/`.

## Summary

| # | Part | Check | Result | Evidence | Date |
|---|------|-------|--------|----------|------|
| 2 | Round 1 app: unit tests | Severity rules, validation, AI parsing, address | PASS 17/17 | `npm test` | 2026-11-10 |
| 3 | Round 1 app: end-to-end in browser | Report → track → admin login → queue → detail → AI | PASS (after 3 fixes) | browser session | 2026-11-10 |
| 1 | Admin dashboard design prototype | Renders, live queue, AI arrival, drawer, assign | PASS (after map fix) | `design/admin-dashboard.html` | 2026-11-10 |

## Details

### 1. Admin dashboard design prototype, 2026-11-10
- **What we checked:** the prototype loads without errors; priority queue sorts by score and counts down deadlines live; an overdue unassigned incident (#106) escalates Medium → High with a toast; a new report (#110) arrives with "AI analyzing…" and is relabelled Critical after ~4.5 s; clicking a row opens the detail drawer with AI analysis, score breakdown, deadline and reporter; "Assign" sets the status to Assigned, marks the team busy, and switches the deadline from "Assign" to "Resolve".
- **How:** opened the file in the Claude desktop browser pane at 1440×900 and 800 px widths, clicked through the flow, and checked the console for errors.
- **Result:** PASS after one fix.
- **Evidence:** browser screenshots taken during the check; console showed no errors.
- **Notes:** **FAIL found first:** the CARTO Voyager map tiles showed "API KEY REQUIRED" (confirmed by downloading a tile directly). **Fix:** switched the map to MapLibre GL + OpenFreeMap (no key). **Re-check:** the map renders with all incident and team markers. Prototype only: sample data, no backend yet.

<!-- One entry per validation, newest at the bottom. Template:

### N. <Part name>, <date>
- **What we checked:**
- **How:** (test name / command / manual steps)
- **Result:** PASS / FAIL
- **Evidence:** (file path, output, screenshot)
- **Notes:** (failures found, what was fixed, re-check result)
-->

### 2. Round 1 app: unit tests, 2026-11-10
- **What we checked:** severity rules (all four levels, people bands, keyword case), report validation (optional title and contact, required fields, bad phone), AI reply parsing (valid JSON in prose; rejects bad severity, non-JSON and out-of-range confidence), address formatting.
- **How:** `npm test` (Node built-in test runner). Also `npm run typecheck`, `npm run lint` and `npm run build`.
- **Result:** PASS, 17/17. Type-check and lint clean; build succeeds.

### 3. Round 1 app: end-to-end in the browser, 2026-11-10
- **What we checked:** chose Road Accident; simulated a phone GPS fix, and the location field showed "Venkatanarayana Road, Ward 136, Chennai, 600017" (no coordinates); typed a description; set people affected to 2; submitted, which opened the tracking page with an auto-generated title. `/admin` redirected to login when signed out; after login the dashboard showed the incident. The rules rated it High; Claude raised it to **Critical (90%)**: "Trapped and bleeding casualty indicates life-threatening injury". The incident map showed CARTO Voyager tiles.
- **How:** Claude desktop browser pane against `npm run dev`; database checked directly.
- **Result:** PASS after three fixes.
- **Fails found and fixed:**
  1. AI stuck on "running": the CLI waited on its input stream and its default model setting was invalid. Fixed with closed stdin and an explicit `--model haiku`.
  2. AI still lost in the app: Next dev runs each request in a short-lived worker process, which killed the in-memory job. Fixed by moving AI into a detached worker script (`scripts/ai-worker.ts`) with a lock file. Re-check: 10 s, Critical 90%.
  3. Map blank, "Worker failed to load": MapLibre 6's separate worker file isn't served by Turbopack. Fixed by pinning MapLibre 4.7.1. Re-check: tiles render.
- **Not checked by a run:** voice input (needs a real microphone; the button shows in Chrome/Edge); photo upload with AI vision; the delete dialog.

### 4. New logo, 2026-11-10
- **What we checked:** the old mark (siren, rays, shield, R, swooshes) blurred at small sizes. It was replaced with one big white "R" on a sandalwood tile, with a health cross inside the R's loop, and a plain "ResQure" wordmark. Checked the mark at 300, 64, 32 and 16 px, on the citizen report page, in the admin side rail and as the favicon (`/icon.svg`).
- **How:** Claude desktop browser pane against `npm run dev`; rendered the favicon SVG at four sizes in the page; `npm run typecheck` and eslint on `src/components/Logo.tsx`.
- **Result:** PASS after one fix.
- **Fail found and fixed:** at large size the cross almost touched the R and the R's loop looked cramped. Fixed by making the loop bigger (radius 11 to 12.5, thinner stroke 7 to 6.5) and centring the cross inside it. Re-check: clear space around the cross at every size.

### 5. Round 2: prioritisation, teams, Assigned status, analytics, 2026-11-10
- **What we checked:**
  - **Priority score** (`src/lib/priority.ts`): severity base + people bonus (max 15) + waiting bonus (max 30, only while no team is assigned) + category bonus (max 10). Covers people bands, waiting reaching the cap at the respond-by deadline, the reason text, a long-waiting Medium overtaking a fresh High, and tie-breaks.
  - **Team management:** create, duplicate name rejected, edit (area and current location), busy team can't be deleted, free team can be deleted and is cleared from old incidents.
  - **Assigned status:** assigning sets Assigned and makes the team Busy; unassigning sets Pending and frees the team; resolving frees the team.
  - **Analytics:** assigned incidents, busy and available teams, and incidents per category.
- **How:** `npm test` (new `src/lib/priority.test.ts`, 6 tests). `npm run check:round2` runs the real data layer against a throwaway database. Also `npm run typecheck`, `npm run lint` and `npm run build`.
- **Result:** PASS. Tests 32/32; smoke check 15/15 (output in `docs/evidence/round2-check.txt`); type-check and lint clean; build succeeds.
- **Fails found and fixed:**
  1. Lint: the team form called setState inside an effect and wrote a ref during render. Fixed by closing the form on save and syncing the ref inside an effect.
  2. The smoke script couldn't import server modules (`server-only` exists only inside Next). Fixed with a small stub preload (`scripts/stub-server-only.mjs`).
- **Not checked by a run yet:** the new admin screens in the browser (queue score line, KPI cards, team add/edit dialog and map picker), because the admin sign-in wasn't available to the check.

### 6. Round 2: analytics charts and queue rank badge, 2026-11-10
- **What we checked:** the Reports page gained an Analytics section with reports per hour over the last 24 hours, a team utilisation ring with the average time to assign a team, incidents by status and open incidents by severity. The status colours failed the colourblind check (dataviz `validate_palette.js`: orange and olive look the same to deutan viewers, ΔE 1.0), so status bars use one sandalwood colour; severity bars keep their colours but always have text labels. The queue rank is now a circle on the card's left edge, replacing the coloured side bar.
- **How:** `npm test` (new `src/lib/analytics.test.ts`: hourly buckets, average, formatting). `npm run check:round2` adds 4 analytics checks. Also `npm run typecheck`, `npm run lint` and `npm run build`.
- **Result:** PASS. Tests 35/35; smoke check 19/19 (`docs/evidence/round2-check.txt`); type-check and lint clean; build succeeds.
- **Not checked by a run yet:** how the charts and the rank badge look in the browser (admin sign-in wasn't available to the check).

### 7. Government services on the map (Chennai), 2026-11-10
- **What we checked:** real fire stations, police stations and government hospitals in and around Chennai, pulled from OpenStreetMap (Overpass API, bbox 12.80–13.30 N, 80.00–80.35 E) by `scripts/fetch-services.ts` into `src/data/chennai-services.json`. Result: **193 places: 16 fire stations, 123 police stations, 54 government hospitals.** OSM has no ambulance bases tagged in Chennai, so none are shown (none invented). Private hospitals are filtered out. The map console has a services layer with one toggle per type (police off by default because there are so many) and a popup on click with the name, the phone (when OSM has one) and directions.
- **How:** `node --test src/lib/services.test.ts` (government-hospital filter, name tidy-up, de-duplication, nearest service). Also checked the 54 hospital names by eye, plus `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`.
- **Result:** PASS. Tests 39/39; type-check and lint clean; build succeeds. Service colours pass the dataviz colourblind check.
- **Fail found and fixed:** the first filter let in private places (Ayesha Hospital, Kilpauk; Malar Clinic, tagged "public"), a naturopathy centre and an Indian-medicine hospital. Fixed by matching "Kilpauk/Stanley Medical" only, ignoring a bare "public" tag, and skipping `emergency=no`, naturopathy, yoga and Indian medicine. Re-check: 54 hospitals, all government-run by name or operator.
- **Not checked by a run yet:** the layer in the browser (admin sign-in wasn't available to the check).

### 8. Citizen backdrop (Chennai skyline, motion, frosted glass), 2026-11-10
- **What we checked:** the report page, the tracking page and the admin sign-in now sit on a fixed backdrop (`src/components/Backdrop.tsx`): the Chennai skyline photo (Wikimedia, CC BY 4.0, credited on the page) graded warm to the sandalwood palette with a slow drift, soft moving light, drifting topo lines at the bottom, a location "ping" and film grain. Cards, call buttons and the logo turn to frosted glass over it. All motion is CSS only and stops under `prefers-reduced-motion`.
- **How:** ran the app in the browser at 1366×850 and 375×812 (phone); read the computed styles (`.bd-photo` animation `bdDrift`, card `backdrop-filter: blur(20px) saturate(1.4)`, photo served through `next/image` optimisation); console checked for errors. Also `npm run typecheck`, `npm run lint`, `npm test`.
- **Result:** PASS. No console errors; type-check and lint clean; tests 45/45. Evidence: `docs/evidence/backdrop-home-desktop.jpg`, `docs/evidence/backdrop-login-mobile.jpg`.
- **Fail found and fixed:** the first grading washed the skyline out almost completely (tint 84% opaque across the middle) and the topo circles showed over the headline. Lowered the tint, added a warm soft-light layer and masked the topo lines to the bottom of the screen. On the phone the ping sat on the headline, so it was moved down over the city.

### 8. Map: smaller service icons and a legend panel, 2026-11-10
- **What we checked:** service pins shrunk to 16 px. A Legend panel (bottom-left, can be hidden or shown) has on/off switches for fire stations, police stations, government hospitals, response teams and team routes, plus the severity colour key.
- **How:** `npm run typecheck`, eslint on `src/components/MapConsole.tsx`, `npm run build`.
- **Result:** PASS. Not yet checked in the browser (admin sign-in wasn't available to the check).

### 9. Admin backdrop (aerial Chennai photo), 2026-11-10
- **What we checked:** the admin panel and admin sign-in now use a new full-screen photo, an aerial view of Chennai with the sun breaking through the clouds (Wikimedia Commons, Eyeofshahvali, CC BY-SA 4.0, credited on the page). It was cropped to a wide 2400×1500 frame and saved as `public/bg/chennai-aerial.jpg` (805 KB, served resized by `next/image`). Same motion layers as the citizen pages, with a lighter veil. The side rail, cards, duty stats and sign-out button turn to frosted glass over it.
- **How:** ran the app in the browser at 1440×900 and checked the sign-in page; read the loaded stylesheet rules in the browser. Also `npm run typecheck`.
- **Result:** PASS for the sign-in page (`docs/evidence/backdrop-admin-login.jpg`); type-check clean.
- **Fail found and fixed:** the sign-in card disappeared behind the photo. The citizen backdrop styles from check 8 had been removed from `globals.css` by a parallel edit, so `.on-bd` was never applied. Fixed by moving every backdrop style into its own file, `src/app/backdrop.css`, imported in `layout.tsx`, so it can't be lost that way again. Re-check: card visible, citizen page styled again. The first veil also washed the photo out, so it was made lighter.
- **Not checked by a run yet:** the signed-in dashboard pages (the admin password is in `.env` and wasn't available to the check).

### 9. Admin background band and police on by default, 2026-11-10
- **What we checked:** on a long admin page in Brave, the bottom of the screen showed a plain white band instead of the aerial photo. In the browser pane the backdrop layer measured full-screen and `position: fixed` even when scrolled, so the band looks like the browser skipping paint on the heavy animated layer. Fix: the admin backdrop layer now has the photo as its own background (fallback), the animated blur glows are off for admin, and `will-change` is removed from the photo. Police stations are now shown on the map by default.
- **How:** layer size and position measured with JavaScript in the browser pane; `npm run typecheck`; eslint on `MapConsole.tsx`.
- **Result:** fix applied; whether the band is gone still needs a look in the user's browser (Brave), where it happened.

### 10. Teams page as one list with checkboxes, 2026-11-10
- **What we checked:** the Teams page is now one box with a row per team (team, status, current job, call/edit/delete), an All / On duty / Available filter, row checkboxes plus select-all, and "Delete selected" with a confirmation dialog. On-duty teams can't be ticked or deleted; the server action skips them too and reports why.
- **How:** `npm run typecheck`, eslint on the teams folder and actions, `npm run build`, `npm test` (the delete rules are covered by `npm run check:round2`).
- **Result:** PASS. Not yet checked in the browser (admin sign-in wasn't available to the check).
- **Fail found and fixed:** opening the page in the user's browser gave "Only plain objects can be passed to Client Components": `node:sqlite` rows have a null prototype. Fixed by copying each team into a plain object before passing it to the client table. Re-check: typecheck and lint clean; page needs a refresh in the browser to confirm.

### 11. Teams: back button on the form and filters, 2026-11-10
- **What we checked:** Add team and Edit now open in a dialog with a back (←) button at the top; Esc and a backdrop click also close it (the user found no clear way back from the inline form). The team table gained a search box (name, area, phone), a Service type filter and an Area filter, working together with the All / On duty / Available tabs and a Reset button. The action buttons now line up on every row.
- **How:** `npm run typecheck`, eslint on the teams folder, `npm run build`.
- **Result:** PASS. Needs a refresh in the user's browser to confirm the look.

### 12. SOS, nearby push alerts, installable SOS app and offline SOS, 2026-11-10
- **What we checked:**
  - **One-tap/hold SOS:** saves a Critical SOS incident (no AI), tops the queue, title from the street address, GPS accuracy in the description; works without GPS too. Family SMS written in demo mode (`data/outbox/…-sms-*.txt`) with a Google Maps link.
  - **Nearby pick:** only subscribers within 3 km with a location under 24 h old; sender, admins, missing and stale locations skipped; closest first.
  - **Nearby alert page** (`/alert/<code>`): red full-screen page, siren starts, "I'm going to help" counted in the DB (helpers = 1) and shown; page ends when resolved or after 6 h.
  - **Repeat SOS:** a second press inside a minute is refused (429); later presses within 10 min re-alert the same incident (position updated, no duplicate).
  - **Push setup:** `/api/push/key` returns the VAPID key; admin subscribe and `/api/admin/sos` refuse signed-out users (401); `/sw.js` and `/manifest.webmanifest` served (200).
  - **Offline:** service worker controls `/sos` and cached 25 files. With the connection reported offline and a GPS fix, holding SOS showed "No internet. Send your SOS by SMS"; the SMS link held the family number and a map link; the SOS was queued and, on the `online` event, sent to the server and cleared from the queue.
- **How:** `npm test` (`src/lib/nearby.test.ts`, 8 tests); `npm run check:sos` (real data layer on a throwaway DB, `docs/evidence/sos-check.txt`); Claude desktop browser pane against `npm run dev` at phone size; API calls with curl; `npm run push:test` to a real phone; `npm run typecheck`, lint, `npm run build`.
- **Result:** PASS after fixes. Tests 47/47; SOS smoke check 15/15; build succeeds. Screenshots: `docs/evidence/sos-sent.jpg`, `sos-countdown.jpg`, `sos-nearby-alert.jpg`, `sos-offline-sms.jpg`.
- **Fails found and fixed:**
  1. The "Sound loud alarm (people near you hear it)" label overflowed its button at phone width. Shortened the label and let action buttons wrap.
  2. Two-phone test: the friend's phone never got the alert. It had turned on notifications but saved no location (GPS denied or timed out indoors), so it was never "nearby". Fixed with a Wi-Fi/cell location fallback and a "Share my location" prompt for phones with alerts on but no location. Re-check: the friend's phone location was saved; a test push was accepted for it.
  3. Retrying the SOS after the friend shared location was blocked by the old 10-minute repeat limit, so nothing was sent. Fixed: a repeat press re-alerts nearby people for the open incident.
  4. The hold timer used animation frames, which pause in a hidden tab, so the hold never finished. Fixed with a plain timer. Re-check: hold completed.
  5. The offline SMS said "The control room has been alerted", which is false offline. Fixed with a separate first-person offline message (unit-tested).
  6. Another session overwrote `globals.css` and dropped the SOS styles; restored.
- **Not checked by a run yet:** the admin SOS banner and siren (admin sign-in not used by the check); a real nearby push arriving on a second phone after the fixes; real offline on a phone (airplane mode with signal) and the SMS app opening; install prompts on Android/iPhone.


### 12. Live vehicle tracking (no simulated speed), 2026-11-10
- **What we checked:** the map no longer moves vehicles by a made-up speed. Each team has a private tracking token. The crew's phone (`/track/<token>`, the "GPS" button on the Teams page) or an in-vehicle GPS unit POSTs positions to `/api/track`; the admin map polls `/api/live` every 5 s and draws each vehicle where it really is, re-routes by road from that point (after it moves 150 m), and shows the ETA, the time since the last GPS fix, speed and accuracy. On scene = within 100 m. Fixes that are too frequent (under 2 s) or too inaccurate (over 500 m) are dropped. Replacing the link revokes the old one. The old time-based `travelProgress` helper was removed.
- **How:** `src/lib/tracking.test.ts` (7 tests); `npm run check:round2` adds 4 tracking checks; curl against the running app: a wrong token gives 401 on `/api/track`, and `/api/live` gives 401 without admin sign-in; `npm run replay-gps -- "Traffic Police TP-11"` sent real fixes through `/api/track` (`docs/evidence/replay-gps.txt`). `scripts/replay-gps.ts` is a test tool that plays a phone's role; the app itself simulates nothing.
- **Result:** PASS. Tests 53/53, smoke check 23/23, type-check and lint clean.
