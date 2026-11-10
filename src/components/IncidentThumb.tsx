import { Icon } from "./Icon";

/** Reporter's photo as a thumbnail; falls back to the category icon when there is no photo. */
export function IncidentThumb({ photo, category, title, size = 38 }: { photo: string | null; category: string; title: string; size?: number }) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- private admin-only photo route, not optimisable
      <img className="thumb" src={`/admin/photos/${photo}`} alt={`Photo: ${title}`} width={size} height={size} loading="lazy"
        style={{ width: size, height: size }} />
    );
  }
  return <span className="type-ic" style={{ width: size, height: size }}><Icon name={category} /></span>;
}
