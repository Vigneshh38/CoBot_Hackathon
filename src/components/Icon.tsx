// Our own icon set: 24px grid, 1.8 stroke, round caps. No icon library.
const PATHS: Record<string, React.ReactNode> = {
  logo: <><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" /><path d="M8 12.5h2l1.2-2.5 1.8 5 1.2-2.5H16" /></>,
  fire: <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.6.2 1.8 1 2.8 2 3.2C11 9 11 6 12 3z" />,
  road_accident: <><path d="M4 13l1.8-5a2 2 0 0 1 1.9-1.4h8.6A2 2 0 0 1 18.2 8L20 13" /><path d="M4 13h16v4H4z" /><path d="M7 17v2M17 17v2M7.5 15h.01M16.5 15h.01" /></>,
  medical: <><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" /><path d="M12 8v8M8 12h8" /></>,
  flood: <path d="M3 8c2 0 2-1.5 4.5-1.5S9.5 8 12 8s2.5-1.5 4.5-1.5S19 8 21 8M3 13c2 0 2-1.5 4.5-1.5S9.5 13 12 13s2.5-1.5 4.5-1.5S19 13 21 13M3 18c2 0 2-1.5 4.5-1.5S9.5 18 12 18s2.5-1.5 4.5-1.5S19 18 21 18" />,
  building_collapse: <><path d="M4 21V9l6-4v16M10 21h10V12l-4-2" /><path d="M7 11h.01M7 15h.01M14 14h.01M14 17h.01M17 5l2-2M19.5 7.5L22 7" /></>,
  other: <><circle cx="6" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18" cy="12" r="1.4" /></>,
  warn: <><path d="M12 3.5L2.8 19.5h18.4L12 3.5z" /><path d="M12 10v4M12 17h.01" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1.2" /><circle cx="4.5" cy="12" r="1.2" /><circle cx="4.5" cy="18" r="1.2" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  checkCircle: <><circle cx="12" cy="12" r="8.5" /><path d="M8 12.3l2.8 2.8L16 9.8" /></>,
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" /><circle cx="12" cy="10" r="2.3" /></>,
  gps: <><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></>,
  people: <><circle cx="8" cy="9" r="2.5" /><circle cx="16" cy="9" r="2.5" /><path d="M3.5 18c.5-2.5 2.3-4 4.5-4s4 1.5 4.5 4M11.5 18c.5-2.5 2.3-4 4.5-4s4 1.5 4.5 4" /></>,
  minus: <path d="M6 12h12" />,
  plus: <path d="M12 6v12M6 12h12" />,
  photo: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-8 8" /></>,
  phone: <path d="M5 4h3.5l2 5-2.4 1.5a11 11 0 0 0 5.4 5.4L15 13.5l5 2V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  ai: <><path d="M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7L11 3.5z" /><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" /></>,
  trash: <><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" /><path d="M10 11v5M14 11v5" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></>,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  shield: <><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></>,
  chart: <path d="M4 20V11M10 20V5M16 20v-6M3 20h18" />,
  send: <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" />,
  map: <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>,
  megaphone: <><path d="M3 10v4h3l7 4V6l-7 4H3z" /><path d="M16.5 9.5a3.5 3.5 0 0 1 0 5M19 7a7 7 0 0 1 0 10" /></>,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  share: <><circle cx="18" cy="5.5" r="2.3" /><circle cx="6" cy="12" r="2.3" /><circle cx="18" cy="18.5" r="2.3" /><path d="M8 11l7.9-4.3M8 13l7.9 4.3" /></>,
  navigate: <path d="M20.5 3.5L3.5 10.8l7 2.7 2.7 7 7.3-17z" />,
  volume: <><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  mute: <><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></>,
  sms: <><path d="M4 5.5h16v10H9.5L5 19.5v-4H4z" /><path d="M8 10.5h.01M12 10.5h.01M16 10.5h.01" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  lock: <><rect x="5" y="10" width="14" height="10" rx="2.5" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /></>,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "ic", title }: { name: string; className?: string; title?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title ? <title>{title}</title> : null}
      {PATHS[name] ?? PATHS.other}
    </svg>
  );
}
