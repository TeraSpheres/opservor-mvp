// Opservor HQ mark — sleek geodesic wireframe sphere. Minimal edge set for
// clean, modern appearance while maintaining 3D depth. Only essential structural
// edges rendered with stratified opacity for visual hierarchy.
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
      <line x1="20" y1="3" x2="26" y2="10" stroke={c} strokeWidth="0.7" opacity={0.9} />
      <line x1="20" y1="3" x2="14" y2="10" stroke={c} strokeWidth="0.7" opacity={0.9} />

      {/* Upper pentagon outline */}
      <line x1="26" y1="10" x2="32" y2="16" stroke={c} strokeWidth="0.7" opacity={0.85} />
      <line x1="14" y1="10" x2="8" y2="16" stroke={c} strokeWidth="0.7" opacity={0.85} />
      <line x1="32" y1="16" x2="28" y2="26" stroke={c} strokeWidth="0.7" opacity={0.8} />
      <line x1="8" y1="16" x2="12" y2="26" stroke={c} strokeWidth="0.7" opacity={0.8} />

      {/* Equatorial band - sides */}
      <line x1="28" y1="26" x2="20" y2="32" stroke={c} strokeWidth="0.7" opacity={0.75} />
      <line x1="12" y1="26" x2="20" y2="32" stroke={c} strokeWidth="0.7" opacity={0.75} />

      {/* Lower band */}
      <line x1="20" y1="32" x2="24" y2="36" stroke={c} strokeWidth="0.7" opacity={0.7} />
      <line x1="20" y1="32" x2="16" y2="36" stroke={c} strokeWidth="0.7" opacity={0.7} />

      {/* Bottom vertex connection */}
      <line x1="24" y1="36" x2="20" y2="38" stroke={c} strokeWidth="0.7" opacity={0.65} />
      <line x1="16" y1="36" x2="20" y2="38" stroke={c} strokeWidth="0.7" opacity={0.65} />

      {/* Connecting cross edges - minimal */}
      <line x1="26" y1="10" x2="32" y2="16" stroke={c} strokeWidth="0.6" opacity={0.4} />
      <line x1="14" y1="10" x2="8" y2="16" stroke={c} strokeWidth="0.6" opacity={0.4} />
    </svg>
  );
}
