/**
 * The PropIT globe, drawn rather than photographed.
 *
 * The brand artwork is a 1254px 3D render: puzzle-piece continents, houses with
 * lit windows, a SOLD board, a book, a map pin, all wrapped in a gold orbit.
 * None of that survives being shown at 28px in a navbar — it becomes a coloured
 * smudge — and a raster would also soften on every non-integer device ratio.
 *
 * So this keeps what is legible at that size and discards what is not: the
 * puzzle-seamed globe, the green-and-blue continents, and the gold ring passing
 * behind the globe and back across its face. The ring is two arcs of one ellipse
 * with the sphere drawn between them, which is what sells the orbit as passing
 * *through* rather than sitting on top.
 *
 * Fixed brand colours in both themes, deliberately: the mark is the one element
 * on the page that should not restyle itself. It carries its own contrast
 * against either ground.
 */
export function PropitMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="PropIT"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="pi-gold" x1="6" y1="18" x2="58" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8D283" />
          <stop offset="0.45" stopColor="#E9A21C" />
          <stop offset="1" stopColor="#C8820A" />
        </linearGradient>
        <linearGradient id="pi-ocean" x1="14" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3D93DD" />
          <stop offset="1" stopColor="#1C6FBE" />
        </linearGradient>
        <linearGradient id="pi-land" x1="16" y1="14" x2="48" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4CBB4F" />
          <stop offset="1" stopColor="#2A9433" />
        </linearGradient>
        {/* Everything continental is cut to the sphere, so the shapes can be
            drawn loosely and still meet the edge cleanly. */}
        <clipPath id="pi-globe">
          <circle cx="31" cy="31" r="21" />
        </clipPath>
      </defs>

      {/* Ring, far side — behind the globe. */}
      <g transform="rotate(-18 32 32)">
        <path
          d="M1.5 33 A30.5 11 0 0 1 62.5 33"
          stroke="url(#pi-gold)"
          strokeWidth="3.4"
          strokeLinecap="round"
          opacity="0.75"
        />
      </g>

      <circle cx="31" cy="31" r="21" fill="url(#pi-ocean)" />

      <g clipPath="url(#pi-globe)">
        {/* Continents as puzzle blocks. Two bands rather than a scatter: at this
            size a recognisable land/sea rhythm beats accurate geography. */}
        <path
          d="M10 20 q6 -5 13 -2 q5 2 9 -1 q6 -4 12 0 q5 3 10 1 v7 q-6 2 -11 -1 q-6 -3 -11 1 q-5 3 -10 1 q-7 -3 -12 2 z"
          fill="url(#pi-land)"
        />
        <path
          d="M8 36 q7 -4 13 -1 q6 3 11 0 q6 -4 12 -1 q5 2 9 0 v7 q-5 2 -9 0 q-6 -3 -11 1 q-6 3 -12 -1 q-6 -3 -13 1 z"
          fill="url(#pi-land)"
        />
        {/*
            Puzzle seams — two, not four.

            The first pass drew a full-width cross plus two verticals at 1.5
            weight, which at 128px read as window mullions rather than puzzle
            joints: a grid, not a jigsaw. What makes a seam legible as a puzzle
            is the *tab*, so these are thinner, fewer, and give each tab a much
            larger radius relative to the line. One seam runs pole-to-pole and
            one across, meeting off-centre so the eye reads interlocking pieces
            instead of quadrants.
        */}
        <g stroke="#F2F6F9" strokeWidth="1.15" opacity="0.85" fill="none" strokeLinecap="round">
          <path d="M24 10 v6.5 a3.4 3.4 0 0 0 0 6.6 V31 a3.4 3.4 0 0 1 0 6.6 V52" />
          <path d="M11 24.5 h7.5 a3.4 3.4 0 0 1 6.6 0 H38 a3.4 3.4 0 0 0 6.6 0 H52" />
        </g>
        {/* A single specular sweep gives the sphere its curvature. */}
        <ellipse cx="23" cy="20" rx="12" ry="8" fill="#FFFFFF" opacity="0.17" transform="rotate(-28 23 20)" />
      </g>

      {/* Ring, near side — crossing in front of the globe. */}
      <g transform="rotate(-18 32 32)">
        <path
          d="M1.5 33 A30.5 11 0 0 0 62.5 33"
          stroke="url(#pi-gold)"
          strokeWidth="3.6"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
