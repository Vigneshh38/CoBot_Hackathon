import Image from "next/image";

/**
 * Page backdrop (citizen: Chennai skyline; admin: aerial Chennai), graded to the sandalwood
 * palette with a slow drift, soft moving light, drifting topo lines, a calm
 * location "ping" and film grain. Pure CSS motion (no JS), fixed behind the
 * page, ignored by screen readers and pointer events. Motion stops under
 * prefers-reduced-motion.
 */
const PHOTOS = {
  citizen: { src: "/bg/chennai-skyline.jpg", title: "Chennai skyline", file: "Chennai-Skyline-from-Mount.jpg", author: "Karthikeyan321", license: "CC BY 4.0" },
  admin: { src: "/bg/chennai-aerial.jpg", title: "Aerial view of Chennai", file: "Aerial_view_of_Chennai_from_Airplane.jpg", author: "Eyeofshahvali", license: "CC BY-SA 4.0" },
} as const;
type Variant = keyof typeof PHOTOS;

export function Backdrop({ variant = "citizen" }: { variant?: Variant }) {
  return (
    <div className={`bd bd-${variant}`} aria-hidden="true">
      <div className="bd-photo">
        <Image src={PHOTOS[variant].src} alt="" fill priority sizes="100vw" quality={75} />
      </div>
      <div className="bd-glow g1" />
      <div className="bd-glow g2" />
      <div className="bd-glow g3" />
      <div className="bd-tint" />
      <div className="bd-topo" />
      <div className="bd-ping">
        <i /><i /><i />
      </div>
      <div className="bd-grain" />
    </div>
  );
}

/** Attribution for the backdrop photo (required by its Creative Commons license). */
export function BackdropCredit({ variant = "citizen" }: { variant?: Variant }) {
  const p = PHOTOS[variant];
  return (
    <p className={`bd-credit bd-credit-${variant}`}>
      Photo:{" "}
      <a href={`https://commons.wikimedia.org/wiki/File:${p.file}`} target="_blank" rel="noreferrer">
        {p.title}
      </a>{" "}
      by {p.author}, {p.license}
    </p>
  );
}
