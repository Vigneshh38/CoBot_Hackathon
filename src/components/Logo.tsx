/**
 * ResQure brand mark (vector recreation of the team's logo, sandalwood theme):
 * a shield topped by a red siren, holding a cyclone, a wave, a house and a flame,
 * cradled by a protecting hand — "every disaster, held safe".
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="ResQure">
      <defs>
        <linearGradient id="rq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf2" />
          <stop offset="1" stopColor="#f1e2c8" />
        </linearGradient>
        <linearGradient id="rq-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#e8590c" />
          <stop offset="1" stopColor="#c92a2a" />
        </linearGradient>
        <linearGradient id="rq-hand" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d9822b" />
          <stop offset="1" stopColor="#b5651d" />
        </linearGradient>
      </defs>

      {/* siren rays + dome */}
      <path d="M32 1.2v3.2M24.2 3.6l1.7 2.5M39.8 3.6l-1.7 2.5M20.2 8.6l2.8.9M43.8 8.6l-2.8.9" stroke="#c92a2a" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M26.6 12.6a5.4 5.4 0 0 1 10.8 0z" fill="#d62828" />
      <path d="M29.3 9.7a2.4 2.4 0 0 1 2-1.4" stroke="#fff" strokeOpacity=".75" strokeWidth="1" strokeLinecap="round" />
      <rect x="24.8" y="12.3" width="14.4" height="2.4" rx="1.2" fill="#7a5a38" />

      {/* shield */}
      <path d="M32 15.6l20 6.6v12.6c0 12-8.4 20.2-20 24.4-11.6-4.2-20-12.4-20-24.4V22.2z" fill="url(#rq-fill)" stroke="#7a5a38" strokeWidth="2.6" strokeLinejoin="round" />

      {/* cyclone */}
      <path d="M22.2 27.2c3.6-2.2 7.4.3 6.4 3.6-.8 2.6-4.6 3-5.8 1-1-1.6.6-3.2 2-2.4M19.6 31.8c-.6 4 3 7.4 7.2 6.2" fill="none" stroke="#3d3a36" strokeWidth="1.7" strokeLinecap="round" />

      {/* house */}
      <path d="M27.8 36.6l4.2-3.8 4.2 3.8v4.6h-8.4z" fill="#5e4329" />
      <rect x="31" y="38.2" width="2" height="3" fill="#f3e8d8" />

      {/* flame */}
      <path d="M41.6 25.8c.6 2.8 3.6 4.2 3.6 7.6a4.2 4.2 0 0 1-8.4 0c0-1.8.8-2.9 1.8-3.7.2 1.3.8 2 1.5 2.3-.6-2.3.2-4.4 1.5-6.2z" fill="url(#rq-flame)" />
      <path d="M41.1 31.8c.6 1 1.6 1.5 1.6 2.8a1.6 1.6 0 0 1-3.2 0c0-.8.5-1.4 1-1.8z" fill="#ffd43b" />

      {/* wave */}
      <path d="M17.2 43.4c2.8-.2 4.2-3.4 7.4-3.4 2.6 0 3.2 2 5.6 2 2.2 0 3-1.4 5.2-1.4" fill="none" stroke="#1f6f78" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M20.2 46.2c2.2 0 3.4-1.8 5.6-1.8s2.8 1.4 4.8 1.4" fill="none" stroke="#3b8f99" strokeWidth="1.6" strokeLinecap="round" />

      {/* protecting hand */}
      <path d="M14.5 47.6c4.2 2.8 9.6 4.6 15.6 4.6 6.4 0 10.6-1.8 14.6-4.4 1.6-1 3.4-.2 3 1.2-.2.8-1 1.4-2 2l-3.8 2.6c-3.6 2.4-7.4 3.6-12 3.6-6 0-11-2.2-15.4-5.8z" fill="url(#rq-hand)" />
      <path d="M44.2 48.2l3.6-2.4c1.4-.9 2.8.4 1.8 1.6" fill="none" stroke="#b5651d" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Shield mark + "ResQure" wordmark. `size` is the mark height in px. */
export function Logo({ size = 40, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      {wordmark ? (
        <span className="logo-word" style={{ fontSize: size * 0.58 }}>
          <span className="lw-res">Res</span><span className="lw-qure">Qure</span>
        </span>
      ) : null}
    </span>
  );
}
