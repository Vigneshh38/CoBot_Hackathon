"use client";

import { Icon } from "./Icon";

/** Calls a real emergency number — asks first so nobody dials 108/112 by accident (e.g. during a demo). */
export function CallButton({ phone, label, who, className = "btn tonal sm" }: { phone: string; label?: string; who: string; className?: string }) {
  const tel = phone.replace(/[^\d+]/g, "");
  return (
    <a className={className} href={`tel:${tel}`} aria-label={`Call ${who} on ${phone}`}
      onClick={(e) => { if (!window.confirm(`Call ${who} on ${phone}?\n\nThis dials the real emergency service.`)) e.preventDefault(); }}>
      <Icon name="phone" className="ic sm" />{label ?? phone}
    </a>
  );
}
