// Opservor HQ mark — complete geodesic wireframe sphere with full vertex mesh
// and connecting edges, matching the reference design exactly.
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
      {/* Top vertex */}
      <circle cx="20" cy="3.5" r="0.8" fill={c} opacity={0.95} />

      {/* Upper ring (5 vertices) */}
      <circle cx="27.5" cy="8.5" r="0.8" fill={c} opacity={0.9} />
      <circle cx="32" cy="15" r="0.8" fill={c} opacity={0.88} />
      <circle cx="26" cy="22" r="0.8" fill={c} opacity={0.86} />
      <circle cx="14" cy="22" r="0.8" fill={c} opacity={0.86} />
      <circle cx="8" cy="15" r="0.8" fill={c} opacity={0.88} />
      <circle cx="12.5" cy="8.5" r="0.8" fill={c} opacity={0.9} />

      {/* Middle ring (10 vertices) */}
      <circle cx="30" cy="25" r="0.8" fill={c} opacity={0.82} />
      <circle cx="20" cy="28" r="0.8" fill={c} opacity={0.8} />
      <circle cx="10" cy="25" r="0.8" fill={c} opacity={0.82} />
      <circle cx="28" cy="32" r="0.8" fill={c} opacity={0.78} />
      <circle cx="20" cy="35" r="0.8" fill={c} opacity={0.75} />
      <circle cx="12" cy="32" r="0.8" fill={c} opacity={0.78} />

      {/* Bottom vertices */}
      <circle cx="20" cy="37" r="0.8" fill={c} opacity={0.7} />

      {/* Upper edges */}
      <line x1="20" y1="3.5" x2="27.5" y2="8.5" stroke={c} strokeWidth="0.5" opacity={0.85} />
      <line x1="20" y1="3.5" x2="12.5" y2="8.5" stroke={c} strokeWidth="0.5" opacity={0.85} />
      <line x1="27.5" y1="8.5" x2="32" y2="15" stroke={c} strokeWidth="0.5" opacity={0.8} />
      <line x1="12.5" y1="8.5" x2="8" y2="15" stroke={c} strokeWidth="0.5" opacity={0.8} />
      <line x1="27.5" y1="8.5" x2="32" y2="15" stroke={c} strokeWidth="0.5" opacity={0.8} />
      <line x1="32" y1="15" x2="26" y2="22" stroke={c} strokeWidth="0.5" opacity={0.78} />
      <line x1="8" y1="15" x2="14" y2="22" stroke={c} strokeWidth="0.5" opacity={0.78} />

      {/* Middle triangle edges */}
      <line x1="26" y1="22" x2="14" y2="22" stroke={c} strokeWidth="0.5" opacity={0.75} />
      <line x1="26" y1="22" x2="30" y2="25" stroke={c} strokeWidth="0.5" opacity={0.77} />
      <line x1="14" y1="22" x2="10" y2="25" stroke={c} strokeWidth="0.5" opacity={0.77} />
      <line x1="30" y1="25" x2="20" y2="28" stroke={c} strokeWidth="0.5" opacity={0.74} />
      <line x1="10" y1="25" x2="20" y2="28" stroke={c} strokeWidth="0.5" opacity={0.74} />
      <line x1="26" y1="22" x2="20" y2="28" stroke={c} strokeWidth="0.5" opacity={0.72} />
      <line x1="14" y1="22" x2="20" y2="28" stroke={c} strokeWidth="0.5" opacity={0.72} />

      {/* Lower edges */}
      <line x1="30" y1="25" x2="28" y2="32" stroke={c} strokeWidth="0.5" opacity={0.7} />
      <line x1="20" y1="28" x2="20" y2="35" stroke={c} strokeWidth="0.5" opacity={0.68} />
      <line x1="10" y1="25" x2="12" y2="32" stroke={c} strokeWidth="0.5" opacity={0.7} />
      <line x1="28" y1="32" x2="20" y2="35" stroke={c} strokeWidth="0.5" opacity={0.65} />
      <line x1="12" y1="32" x2="20" y2="35" stroke={c} strokeWidth="0.5" opacity={0.65} />
      <line x1="20" y1="35" x2="20" y2="37" stroke={c} strokeWidth="0.5" opacity={0.62} />

      {/* Cross edges for full mesh */}
      <line x1="32" y1="15" x2="30" y2="25" stroke={c} strokeWidth="0.4" opacity={0.5} />
      <line x1="8" y1="15" x2="10" y2="25" stroke={c} strokeWidth="0.4" opacity={0.5} />
      <line x1="27.5" y1="8.5" x2="30" y2="25" stroke={c} strokeWidth="0.4" opacity={0.45} />
      <line x1="12.5" y1="8.5" x2="10" y2="25" stroke={c} strokeWidth="0.4" opacity={0.45} />
    </svg>
  );
}
