"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { LogoMark } from "@/components/Logo";

const ITEMS = [
  { href: "/admin", label: "Incidents", icon: "list", match: (p: string) => p === "/admin" || p.startsWith("/admin/incidents") },
  { href: "/admin/map", label: "Map", icon: "map", match: (p: string) => p.startsWith("/admin/map") },
  { href: "/admin/teams", label: "Teams", icon: "people", match: (p: string) => p.startsWith("/admin/teams") },
  { href: "/admin/reports", label: "Reports", icon: "chart", match: (p: string) => p.startsWith("/admin/reports") },
];
const SOON = [
  { label: "Alerts", icon: "megaphone" },
];

export function AdminRail({ unseen = 0 }: { unseen?: number }) {
  const path = usePathname();
  return (
    <nav className="rail" aria-label="Admin sections">
      <span className="rail-logo" title="ResQure Control Center"><LogoMark size={44} /></span>
      {ITEMS.map((it) => {
        const on = it.match(path);
        return (
          <Link key={it.href} href={it.href} className={`rail-item ${on ? "active" : ""}`} aria-current={on ? "page" : undefined}>
            <span className="pill"><Icon name={it.icon} />{it.href === "/admin" && unseen > 0 ? <span className="rail-count" aria-label={`${unseen} new`}>{unseen > 99 ? "99+" : unseen}</span> : null}</span>{it.label}
          </Link>
        );
      })}
      {SOON.map((it) => (
        <span key={it.label} className="rail-item soon" title="Coming in the next round">
          <span className="pill"><Icon name={it.icon} /></span>{it.label}
        </span>
      ))}
    </nav>
  );
}
