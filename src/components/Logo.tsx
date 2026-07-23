// Opservor HQ mark — refined geodesic wireframe sphere with visible nodes.
// Thin connecting edges and small dots at vertices create elegant, minimal design.
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
      {/* Edges - thin lines */}
      <line x1="20" y1="4" x2="28" y2="10" stroke={c} strokeWidth="0.5" opacity={0.8} />
      <line x1="20" y1="4" x2="12" y2="10" stroke={c} strokeWidth="0.5" opacity={0.8} />
      <line x1="28" y1="10" x2="34" y2="18" stroke={c} strokeWidth="0.5" opacity={0.75} />
      <line x1="12" y1="10" x2="6" y2="18" stroke={c} strokeWidth="0.5" opacity={0.75} />
      <line x1="28" y1="10" x2="26" y2="20" stroke={c} strokeWidth="0.5" opacity={0.78} />
      <line x1="12" y1="10" x2="14" y2="20" stroke={c} strokeWidth="0.5" opacity={0.78} />

      <line x1="34" y1="18" x2="32" y2="28" stroke={c} strokeWidth="0.5" opacity={0.7} />
      <line x1="6" y1="18" x2="8" y2="28" stroke={c} strokeWidth="0.5" opacity={0.7} />
      <line x1="26" y1="20" x2="32" y2="28" stroke={c} strokeWidth="0.5" opacity={0.72} />
      <line x1="14" y1="20" x2="8" y2="28" stroke={c} strokeWidth="0.5" opacity={0.72} />

      <line x1="20" y1="16" x2="26" y2="20" stroke={c} strokeWidth="0.5" opacity={0.7} />
      <line x1="20" y1="16" x2="14" y2="20" stroke={c} strokeWidth="0.5" opacity={0.7} />
      <line x1="20" y1="16" x2="32" y2="28" stroke={c} strokeWidth="0.5" opacity={0.65} />
      <line x1="20" y1="16" x2="8" y2="28" stroke={c} strokeWidth="0.5" opacity={0.65} />

      <line x1="32" y1="28" x2="24" y2="35" stroke={c} strokeWidth="0.5" opacity={0.62} />
      <line x1="8" y1="28" x2="16" y2="35" stroke={c} strokeWidth="0.5" opacity={0.62} />
      <line x1="24" y1="35" x2="16" y2="35" stroke={c} strokeWidth="0.5" opacity={0.6} />
      <line x1="20" y1="16" x2="24" y2="35" stroke={c} strokeWidth="0.5" opacity={0.55} />
      <line x1="20" y1="16" x2="16" y2="35" stroke={c} strokeWidth="0.5" opacity={0.55} />

      {/* Vertices - nodes/dots */}
      <circle cx="20" cy="4" r="1.2" fill={c} opacity={0.9} />
      <circle cx="28" cy="10" r="1.2" fill={c} opacity={0.85} />
      <circle cx="12" cy="10" r="1.2" fill={c} opacity={0.85} />
      <circle cx="34" cy="18" r="1.2" fill={c} opacity={0.75} />
      <circle cx="6" cy="18" r="1.2" fill={c} opacity={0.75} />
      <circle cx="26" cy="20" r="1.2" fill={c} opacity={0.78} />
      <circle cx="14" cy="20" r="1.2" fill={c} opacity={0.78} />
      <circle cx="20" cy="16" r="1" fill={c} opacity={0.7} />
      <circle cx="32" cy="28" r="1.2" fill={c} opacity={0.68} />
      <circle cx="8" cy="28" r="1.2" fill={c} opacity={0.68} />
      <circle cx="24" cy="35" r="1.2" fill={c} opacity={0.62} />
      <circle cx="16" cy="35" r="1.2" fill={c} opacity={0.62} />
    </svg>
  );
}
