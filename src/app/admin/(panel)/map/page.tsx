import { AutoRefresh } from "@/components/AutoRefresh";
import { MapConsole, type MapIncident, type MapTeam } from "@/components/MapConsole";
import { listQueue, listTeams } from "@/lib/incidents";
import { categoryLabel, severityLabel, statusLabel } from "@/lib/constants";
import { TEAM_KINDS } from "@/lib/dispatch";
import type { Service } from "@/lib/services";
import servicesData from "@/data/chennai-services.json";

export const dynamic = "force-dynamic";

export default function MapPage() {
  const incidents: MapIncident[] = listQueue()
    .filter((i) => i.lat != null && i.lng != null)
    .map((i) => ({
      id: i.id, title: i.title, category: i.category, categoryLabel: categoryLabel(i.category),
      severity: i.severity, severityLabel: severityLabel(i.severity), status: i.status, statusLabel: statusLabel(i.status),
      location: i.location, lat: i.lat!, lng: i.lng!, people: i.people_affected, createdAt: i.created_at,
      summary: i.ai_summary ?? i.description, teamId: i.team_id, assignedAt: i.assigned_at,
    }));
  const teams: MapTeam[] = listTeams().map((t) => ({
    id: t.id, name: t.name, kind: t.kind, kindLabel: TEAM_KINDS[t.kind], area: t.area, phone: t.phone, lat: t.lat, lng: t.lng, busyWith: t.busyWith,
  }));
  return (
    <main className="map-page">
      <AutoRefresh seconds={20} />
      <MapConsole incidents={incidents} teams={teams} services={servicesData.services as Service[]} />
    </main>
  );
}
