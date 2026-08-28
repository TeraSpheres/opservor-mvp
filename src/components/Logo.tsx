/* The Opservor mark.
 *
 * This used to be an SVG that reconstructed the mark from arcs and gradients —
 * two bands orbiting a sphere, drawn here rather than loaded. The geometry was
 * carefully checked against a sampled version of the curve, and it was still
 * the wrong approach: the real mark is a dotted globe inside two orbital
 * ribbons, it lives in the brand folder, and an interpretation of it is not it.
 *
 * The same fault was found in three other places on the same day — the
 * generated screens, the deck, and the screen renderer — all of them drawing
 * a blue ball where the asset should have been. Any mark that is drawn will
 * eventually disagree with the one that is stored. So this loads the file.
 *
 * The API is unchanged, so every call site keeps working: pass `size` for a
 * pixel value, or `className` with Tailwind height/width utilities as the
 * sidebar and login screen do.
 */

/* The disc behind the mark. The artwork is a glowing globe on a dark ground
 * and it is designed for one — dropped straight onto a light surface its glow
 * has nothing to sit against. The disc travels with it so the mark looks the
 * same wherever it is used. */
const DISC =
  "radial-gradient(circle at 50% 42%, #0C1A33 0%, #070F1E 66%, #040A14 100%)";

export default function Logo({
  size,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        position: "relative",
        overflow: "hidden",
        borderRadius: "50%",
        background: DISC,
        boxShadow: "0 0 10px rgba(59,130,246,.45)",
        ...(size ? { width: size, height: size } : null),
      }}
      role="img"
      aria-label="Opservor"
    >
      {/* Slightly under 100%, so the orbit ribbons keep clear of the rim
          rather than being clipped by it. */}
      <img
        src="/brand/opservor-256.png"
        alt=""
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "97%",
          height: "97%",
          transform: "translate(-50%, -50%)",
        }}
      />
    </span>
  );
}
