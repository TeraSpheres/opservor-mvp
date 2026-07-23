// Opservor HQ mark — complete geodesic wireframe sphere. Full icosahedron-based
// structure with all vertices and edges visible, creating an intricate geometric
// lattice. Coordinates pre-computed for efficient rendering.
export default function Logo({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const c = "#3B82F6";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Opservor HQ"
      className={className}
    >
      {/* Top vertex edges */}
      <line x1="20" y1="2" x2="24.7" y2="7.5" stroke={c} strokeWidth="0.6" opacity={0.85} />
      <line x1="20" y1="2" x2="15.3" y2="7.5" stroke={c} strokeWidth="0.6" opacity={0.85} />
      <line x1="20" y1="2" x2="27.5" y2="12" stroke={c} strokeWidth="0.6" opacity={0.85} />
      <line x1="20" y1="2" x2="12.5" y2="12" stroke={c} strokeWidth="0.6" opacity={0.85} />

      {/* Upper pentagon ring */}
      <line x1="24.7" y1="7.5" x2="27.5" y2="12" stroke={c} strokeWidth="0.6" opacity={0.8} />
      <line x1="24.7" y1="7.5" x2="31" y2="10" stroke={c} strokeWidth="0.6" opacity={0.8} />
      <line x1="15.3" y1="7.5" x2="12.5" y2="12" stroke={c} strokeWidth="0.6" opacity={0.8} />
      <line x1="15.3" y1="7.5" x2="9" y2="10" stroke={c} strokeWidth="0.6" opacity={0.8} />
      <line x1="27.5" y1="12" x2="31" y2="10" stroke={c} strokeWidth="0.6" opacity={0.8} />
      <line x1="12.5" y1="12" x2="9" y2="10" stroke={c} strokeWidth="0.6" opacity={0.8} />

      {/* Upper middle band */}
      <line x1="31" y1="10" x2="33" y2="18" stroke={c} strokeWidth="0.6" opacity={0.77} />
      <line x1="9" y1="10" x2="7" y2="18" stroke={c} strokeWidth="0.6" opacity={0.77} />
      <line x1="27.5" y1="12" x2="32" y2="20" stroke={c} strokeWidth="0.6" opacity={0.75} />
      <line x1="12.5" y1="12" x2="8" y2="20" stroke={c} strokeWidth="0.6" opacity={0.75} />
      <line x1="31" y1="10" x2="27.5" y2="12" stroke={c} strokeWidth="0.6" opacity={0.78} />
      <line x1="9" y1="10" x2="12.5" y2="12" stroke={c} strokeWidth="0.6" opacity={0.78} />

      {/* Equatorial ring - outer */}
      <line x1="33" y1="18" x2="32" y2="20" stroke={c} strokeWidth="0.6" opacity={0.72} />
      <line x1="7" y1="18" x2="8" y2="20" stroke={c} strokeWidth="0.6" opacity={0.72} />
      <line x1="33" y1="18" x2="35" y2="22" stroke={c} strokeWidth="0.6" opacity={0.7} />
      <line x1="7" y1="18" x2="5" y2="22" stroke={c} strokeWidth="0.6" opacity={0.7} />
      <line x1="32" y1="20" x2="35" y2="22" stroke={c} strokeWidth="0.6" opacity={0.72} />
      <line x1="8" y1="20" x2="5" y2="22" stroke={c} strokeWidth="0.6" opacity={0.72} />

      {/* Equatorial center band */}
      <line x1="32" y1="20" x2="28" y2="25" stroke={c} strokeWidth="0.6" opacity={0.73} />
      <line x1="8" y1="20" x2="12" y2="25" stroke={c} strokeWidth="0.6" opacity={0.73} />
      <line x1="35" y1="22" x2="30" y2="28" stroke={c} strokeWidth="0.6" opacity={0.68} />
      <line x1="5" y1="22" x2="10" y2="28" stroke={c} strokeWidth="0.6" opacity={0.68} />
      <line x1="20" y1="20" x2="28" y2="25" stroke={c} strokeWidth="0.6" opacity={0.74} />
      <line x1="20" y1="20" x2="12" y2="25" stroke={c} strokeWidth="0.6" opacity={0.74} />
      <line x1="20" y1="20" x2="30" y2="28" stroke={c} strokeWidth="0.6" opacity={0.7} />
      <line x1="20" y1="20" x2="10" y2="28" stroke={c} strokeWidth="0.6" opacity={0.7} />

      {/* Lower middle band */}
      <line x1="28" y1="25" x2="30" y2="28" stroke={c} strokeWidth="0.6" opacity={0.68} />
      <line x1="12" y1="25" x2="10" y2="28" stroke={c} strokeWidth="0.6" opacity={0.68} />
      <line x1="28" y1="25" x2="24" y2="31" stroke={c} strokeWidth="0.6" opacity={0.65} />
      <line x1="12" y1="25" x2="16" y2="31" stroke={c} strokeWidth="0.6" opacity={0.65} />
      <line x1="30" y1="28" x2="26" y2="33" stroke={c} strokeWidth="0.6" opacity={0.62} />
      <line x1="10" y1="28" x2="14" y2="33" stroke={c} strokeWidth="0.6" opacity={0.62} />

      {/* Lower pentagon ring */}
      <line x1="24" y1="31" x2="26" y2="33" stroke={c} strokeWidth="0.6" opacity={0.63} />
      <line x1="16" y1="31" x2="14" y2="33" stroke={c} strokeWidth="0.6" opacity={0.63} />
      <line x1="24" y1="31" x2="20" y2="36" stroke={c} strokeWidth="0.6" opacity={0.6} />
      <line x1="16" y1="31" x2="20" y2="36" stroke={c} strokeWidth="0.6" opacity={0.6} />
      <line x1="26" y1="33" x2="23" y2="37.5" stroke={c} strokeWidth="0.6" opacity={0.58} />
      <line x1="14" y1="33" x2="17" y2="37.5" stroke={c} strokeWidth="0.6" opacity={0.58} />
      <line x1="20" y1="36" x2="23" y2="37.5" stroke={c} strokeWidth="0.6" opacity={0.58} />
      <line x1="20" y1="36" x2="17" y2="37.5" stroke={c} strokeWidth="0.6" opacity={0.58} />

      {/* Bottom vertices edges */}
      <line x1="23" y1="37.5" x2="20" y2="38.5" stroke={c} strokeWidth="0.6" opacity={0.55} />
      <line x1="17" y1="37.5" x2="20" y2="38.5" stroke={c} strokeWidth="0.6" opacity={0.55} />

      {/* Interior structure - cross edges */}
      <line x1="20" y1="20" x2="24.7" y2="7.5" stroke={c} strokeWidth="0.5" opacity={0.35} />
      <line x1="20" y1="20" x2="15.3" y2="7.5" stroke={c} strokeWidth="0.5" opacity={0.35} />
      <line x1="20" y1="20" x2="31" y2="10" stroke={c} strokeWidth="0.5" opacity={0.3} />
      <line x1="20" y1="20" x2="9" y2="10" stroke={c} strokeWidth="0.5" opacity={0.3} />
    </svg>
  );
}
