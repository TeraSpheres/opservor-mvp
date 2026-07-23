// Opservor HQ mark — bold geodesic wireframe sphere. Thick, confident strokes
// forming complete icosahedron structure with striking 3D presence.
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
      <line x1="20" y1="2" x2="24.7" y2="9" stroke={c} strokeWidth="1.2" opacity={0.95} strokeLinecap="round" />
      <line x1="20" y1="2" x2="15.3" y2="9" stroke={c} strokeWidth="1.2" opacity={0.95} strokeLinecap="round" />

      {/* Upper left edges */}
      <line x1="15.3" y1="9" x2="8" y2="12" stroke={c} strokeWidth="1.2" opacity={0.9} strokeLinecap="round" />
      <line x1="15.3" y1="9" x2="10" y2="20" stroke={c} strokeWidth="1.2" opacity={0.88} strokeLinecap="round" />

      {/* Upper right edges */}
      <line x1="24.7" y1="9" x2="32" y2="12" stroke={c} strokeWidth="1.2" opacity={0.9} strokeLinecap="round" />
      <line x1="24.7" y1="9" x2="30" y2="20" stroke={c} strokeWidth="1.2" opacity={0.88} strokeLinecap="round" />

      {/* Top horizontal edges */}
      <line x1="8" y1="12" x2="32" y2="12" stroke={c} strokeWidth="1.2" opacity={0.85} strokeLinecap="round" />

      {/* Upper side edges */}
      <line x1="8" y1="12" x2="10" y2="20" stroke={c} strokeWidth="1.2" opacity={0.83} strokeLinecap="round" />
      <line x1="32" y1="12" x2="30" y2="20" stroke={c} strokeWidth="1.2" opacity={0.83} strokeLinecap="round" />

      {/* Middle horizontal edges */}
      <line x1="10" y1="20" x2="20" y2="28" stroke={c} strokeWidth="1.2" opacity={0.8} strokeLinecap="round" />
      <line x1="30" y1="20" x2="20" y2="28" stroke={c} strokeWidth="1.2" opacity={0.8} strokeLinecap="round" />

      {/* Lower left edges */}
      <line x1="10" y1="20" x2="6" y2="30" stroke={c} strokeWidth="1.2" opacity={0.78} strokeLinecap="round" />
      <line x1="20" y1="28" x2="8" y2="36" stroke={c} strokeWidth="1.2" opacity={0.75} strokeLinecap="round" />

      {/* Lower right edges */}
      <line x1="30" y1="20" x2="34" y2="30" stroke={c} strokeWidth="1.2" opacity={0.78} strokeLinecap="round" />
      <line x1="20" y1="28" x2="32" y2="36" stroke={c} strokeWidth="1.2" opacity={0.75} strokeLinecap="round" />

      {/* Bottom edges */}
      <line x1="6" y1="30" x2="8" y2="36" stroke={c} strokeWidth="1.2" opacity={0.72} strokeLinecap="round" />
      <line x1="34" y1="30" x2="32" y2="36" stroke={c} strokeWidth="1.2" opacity={0.72} strokeLinecap="round" />
      <line x1="8" y1="36" x2="32" y2="36" stroke={c} strokeWidth="1.2" opacity={0.7} strokeLinecap="round" />

      {/* Center vertical structure */}
      <line x1="20" y1="9" x2="20" y2="28" stroke={c} strokeWidth="1" opacity={0.6} strokeLinecap="round" />
      <line x1="6" y1="30" x2="34" y2="30" stroke={c} strokeWidth="1" opacity={0.55} strokeLinecap="round" />
    </svg>
  );
}
