/**
 * Round 2 smoke check: runs the real data layer against a throwaway database in a temp folder.
 * Usage: node --import ./scripts/stub-server-only.mjs scripts/check-round2.ts
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "resqure-r2-"));
process.chdir(tmp); // db.ts stores data/app.db under the current folder
const lib = await import("../src/lib/incidents.ts");
const { db } = await import("../src/lib/db.ts");

const ok = (cond: boolean, msg: string) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) process.exitCode = 1; };
const base = { description: "test report", location: "Guindy, Chennai", lat: 13.01, lng: 80.22, contactPhone: "9000000000" };

// Team management
ok(lib.listTeams().length === 8, "8 seed teams exist");
ok(lib.createTeam({ name: "Ambulance A-30", kind: "medical", area: "Tambaram", lat: 12.92, lng: 80.12, phone: "108" }) === null, "create team");
ok(lib.createTeam({ name: "Ambulance A-30", kind: "medical", area: "X", lat: 1, lng: 1, phone: "108" })?.includes("already exists") === true, "duplicate team name rejected");
const t = lib.listTeams().find((x) => x.name === "Ambulance A-30")!;
ok(lib.updateTeam(t.id, { name: "Ambulance A-30", kind: "medical", area: "Chromepet", lat: 12.95, lng: 80.14, phone: "108" }) === null
  && lib.getTeam(t.id)!.area === "Chromepet" && lib.getTeam(t.id)!.lat === 12.95, "edit team (area + current location)");

// Assigned status + availability
const inc = lib.createIncident({ ...base, category: "medical", peopleAffected: 1 } as never);
ok(inc.status === "reported", "new incident is Reported");
ok(lib.assignTeam(inc.id, t.id) === null && lib.getIncident(inc.id)!.status === "assigned", "assigning a team sets status Assigned");
ok(lib.getTeam(t.id)!.busyWith === inc.id, "team becomes Busy");
ok(lib.deleteTeam(t.id)?.includes("busy") === true, "busy team cannot be deleted");
let s = lib.getStats();
ok(s.assigned === 1 && s.teamsBusy === 1 && s.teamsFree === 8 && s.teamsTotal === 9, `stats: assigned=${s.assigned} busy=${s.teamsBusy} free=${s.teamsFree}`);
lib.updateStatus(inc.id, "in_progress");
lib.unassignTeam(inc.id);
ok(lib.getIncident(inc.id)!.status === "pending" && lib.getTeam(t.id)!.busyWith == null, "unassign -> Pending, team Available");
lib.assignTeam(inc.id, t.id);
lib.updateStatus(inc.id, "resolved");
ok(lib.getTeam(t.id)!.busyWith == null, "resolving frees the team");
ok(lib.deleteTeam(t.id) === null && !lib.getTeam(t.id), "free team can be deleted");
ok(lib.getIncident(inc.id)!.team_id === null, "deleted team is cleared from its old incidents");

// Priority queue
const big = lib.createIncident({ ...base, category: "building_collapse", peopleAffected: 30, description: "people trapped" } as never);
const small = lib.createIncident({ ...base, category: "other", peopleAffected: 1 } as never);
const q = lib.listQueue();
ok(q[0].id === big.id && q[q.length - 1].id === small.id, "queue ranks by priority score");
console.log("      top:", `#${q[0].id} score ${q[0].priority.score} = ${q[0].priority.reason}`);
s = lib.getStats();
ok(s.byCategory.find((c) => c.id === "building_collapse")!.n === 1, "category distribution counts");

// Analytics charts data
const an = lib.getAnalytics();
ok(an.hourly.length === 24 && an.hourly[23].n === 3, `hourly chart: ${an.hourly[23].n} reports in the current hour`);
ok(an.byStatus.find((x) => x.id === "resolved")!.n === 1 && an.byStatus.find((x) => x.id === "reported")!.n === 2, "status chart counts");
ok(an.openBySeverity.reduce((n, x) => n + x.n, 0) === 2, "severity chart counts open incidents only");
ok(an.avgAssignMin != null && an.avgAssignMin >= 0, `average time to assign: ${an.avgAssignMin} min`);

// Live tracking: token, fixes, revoke
const tt = lib.listTeams()[0];
ok(typeof tt.track_token === "string" && tt.track_token.length >= 30, "every team has a long tracking token");
ok(lib.getTeamByToken(tt.track_token)?.id === tt.id && lib.getTeamByToken("nope") === undefined, "token finds its team; wrong token finds none");
lib.saveTeamFix(tt.id, { lat: 13.0601, lng: 80.2502, accuracy: 9, speed: 10 }, Date.now());
const lp = lib.listLivePositions().find((p) => p.id === tt.id);
ok(lp?.lat === 13.0601 && lp.speed === 10, "a vehicle fix is stored and listed for the map");
const oldToken = tt.track_token;
lib.regenerateTrackToken(tt.id);
ok(lib.getTeamByToken(oldToken) === undefined && lib.getTeam(tt.id)!.track_token !== oldToken && lib.getTeam(tt.id)!.live_at === null, "replacing the link revokes the old token");

db.close();
process.chdir(os.tmpdir());
fs.rmSync(tmp, { recursive: true, force: true });
