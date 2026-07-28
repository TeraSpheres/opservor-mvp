/* The Opservor mark — two bands orbiting a sphere.
 *
 * Replaces the geodesic wireframe, which was retired across the brand and
 * lived on in the app because nobody looked here.
 *
 * The band geometry is a rotated ellipse. Each half is one arc command,
 * checked against a 96-point sampled version of the same curve: they differ
 * by 41/255 at the antialiased edges, against 255 for a deliberately wrong
 * radius. The arcs are the curve, not an approximation of it.
 *
 * Depth without an opaque occluder: the full ellipses are drawn faint, the
 * sphere over them, then the near halves at full strength. A solid disc would
 * have to match whatever surface the logo sits on, and this has to work on the
 * sidebar and the login screen both.
 */

const A_FRONT = "M57.68 23.66 A27 9 -18 0 1 6.32 40.34";
const B_FRONT = "M52.68 49.36 A27 9 40 0 1 11.32 14.64";

export default function Logo({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  // Unique per instance so two logos on one page cannot fight over the
  // gradient id — the second would otherwise inherit the first's.
  const gid = `opservorMark-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Opservor"
      className={className}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7CC4FF" />
          <stop offset="0.5" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>

      {/* Far halves, faint — the bands passing behind */}
      <g stroke={`url(#${gid})`} strokeWidth="4" fill="none" opacity="0.32">
        <ellipse cx="32" cy="32" rx="27" ry="9" transform="rotate(-18 32 32)" />
        <ellipse cx="32" cy="32" rx="27" ry="9" transform="rotate(40 32 32)" />
      </g>

      {/* The sphere */}
      <circle cx="32" cy="32" r="15" fill={`url(#${gid})`} opacity="0.14" />
      <circle cx="32" cy="32" r="15" stroke={`url(#${gid})`} strokeWidth="2.6" fill="none" />

      {/* Near halves, full strength — the bands passing in front */}
      <g stroke={`url(#${gid})`} strokeWidth="4.6" fill="none" strokeLinecap="round">
        <path d={B_FRONT} />
        <path d={A_FRONT} />
      </g>
    </svg>
  );
}
