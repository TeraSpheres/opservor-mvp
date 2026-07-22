// Opservor HQ mark — geodesic wireframe sphere. Full point set (24, evenly
// distributed via Fibonacci sphere + convex-hull triangulation) preserves a
// smooth round silhouette; only front-facing edges are drawn (z > -0.15) so
// the middle stays clean without losing the circular shape. Coordinates are
// pre-computed — no runtime math needed.
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
      {/* Top hemisphere edges */}
      <line x1="20" y1="4.2" x2="27.1" y2="8.6" stroke={c} strokeWidth="0.7" opacity={0.8} />
      <line x1="20" y1="4.2" x2="12.9" y2="8.6" stroke={c} strokeWidth="0.7" opacity={0.8} />
      <line x1="27.1" y1="8.6" x2="31.4" y2="16.1" stroke={c} strokeWidth="0.7" opacity={0.75} />
      <line x1="12.9" y1="8.6" x2="8.6" y2="16.1" stroke={c} strokeWidth="0.7" opacity={0.75} />
      <line x1="27.1" y1="8.6" x2="20" y2="14.2" stroke={c} strokeWidth="0.7" opacity={0.77} />
      <line x1="12.9" y1="8.6" x2="20" y2="14.2" stroke={c} strokeWidth="0.7" opacity={0.77} />

      {/* Upper middle band */}
      <line x1="31.4" y1="16.1" x2="35.1" y2="24.8" stroke={c} strokeWidth="0.7" opacity={0.7} />
      <line x1="8.6" y1="16.1" x2="4.9" y2="24.8" stroke={c} strokeWidth="0.7" opacity={0.7} />
      <line x1="31.4" y1="16.1" x2="24.5" y2="19.8" stroke={c} strokeWidth="0.7" opacity={0.72} />
      <line x1="8.6" y1="16.1" x2="15.5" y2="19.8" stroke={c} strokeWidth="0.7" opacity={0.72} />
      <line x1="20" y1="14.2" x2="24.5" y2="19.8" stroke={c} strokeWidth="0.7" opacity={0.73} />
      <line x1="20" y1="14.2" x2="15.5" y2="19.8" stroke={c} strokeWidth="0.7" opacity={0.73} />

      {/* Equatorial band */}
      <line x1="35.1" y1="24.8" x2="31.4" y2="33.5" stroke={c} strokeWidth="0.7" opacity={0.68} />
      <line x1="4.9" y1="24.8" x2="8.6" y2="33.5" stroke={c} strokeWidth="0.7" opacity={0.68} />
      <line x1="35.1" y1="24.8" x2="24.5" y2="29.2" stroke={c} strokeWidth="0.7" opacity={0.7} />
      <line x1="4.9" y1="24.8" x2="15.5" y2="29.2" stroke={c} strokeWidth="0.7" opacity={0.7} />
      <line x1="24.5" y1="19.8" x2="24.5" y2="29.2" stroke={c} strokeWidth="0.7" opacity={0.68} />
      <line x1="15.5" y1="19.8" x2="15.5" y2="29.2" stroke={c} strokeWidth="0.7" opacity={0.68} />
      <line x1="24.5" y1="29.2" x2="20" y2="34.7" stroke={c} strokeWidth="0.7" opacity={0.65} />
      <line x1="15.5" y1="29.2" x2="20" y2="34.7" stroke={c} strokeWidth="0.7" opacity={0.65} />

      {/* Lower hemisphere edges */}
      <line x1="31.4" y1="33.5" x2="20" y2="38.2" stroke={c} strokeWidth="0.7" opacity={0.62} />
      <line x1="8.6" y1="33.5" x2="20" y2="38.2" stroke={c} strokeWidth="0.7" opacity={0.62} />
      <line x1="31.4" y1="33.5" x2="27.1" y2="31.4" stroke={c} strokeWidth="0.7" opacity={0.65} />
      <line x1="8.6" y1="33.5" x2="12.9" y2="31.4" stroke={c} strokeWidth="0.7" opacity={0.65} />

      {/* Interior structural edges (low opacity for depth) */}
      <line x1="24.5" y1="19.8" x2="31.4" y2="16.1" stroke={c} strokeWidth="0.6" opacity={0.5} />
      <line x1="15.5" y1="19.8" x2="8.6" y2="16.1" stroke={c} strokeWidth="0.6" opacity={0.5} />
      <line x1="24.5" y1="29.2" x2="35.1" y2="24.8" stroke={c} strokeWidth="0.6" opacity={0.45} />
      <line x1="15.5" y1="29.2" x2="4.9" y2="24.8" stroke={c} strokeWidth="0.6" opacity={0.45} />
    </svg>
  );
}
