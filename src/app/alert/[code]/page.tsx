import { notFound } from "next/navigation";
import { getIncidentByCode } from "@/lib/incidents";
import { sosAlertEnded } from "@/lib/nearby";
import { AlertView } from "./AlertView";

export const dynamic = "force-dynamic";

/** What a nearby person sees after tapping an SOS notification. No name or phone of the person in danger. */
export default async function AlertPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const inc = /^[A-F0-9]{10}$/.test(code) ? getIncidentByCode(code) : undefined;
  if (!inc || !inc.is_sos) notFound();
  const ended = sosAlertEnded(inc.status, inc.created_at);

  return (
    <AlertView
      code={inc.code}
      ended={ended}
      location={inc.location}
      lat={ended ? null : inc.lat}
      lng={ended ? null : inc.lng}
      createdAt={inc.created_at}
      helpers={inc.helpers}
      teamOnWay={inc.team_id != null}
    />
  );
}
