export default function Logo({
  className = "h-8 w-8",
  color = "#3B82F6",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Opservor logo"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="50" r="34" fill="none" stroke={color} strokeWidth="3" />
      <ellipse
        cx="50"
        cy="50"
        rx="34"
        ry="12"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        transform="rotate(0 50 50)"
      />
      <ellipse
        cx="50"
        cy="50"
        rx="34"
        ry="12"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        transform="rotate(60 50 50)"
      />
      <ellipse
        cx="50"
        cy="50"
        rx="34"
        ry="12"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        transform="rotate(120 50 50)"
      />
      <circle cx="84" cy="50" r="3" fill={color} />
      <circle cx="16" cy="50" r="3" fill={color} />
      <circle cx="67" cy="79.4" r="3" fill={color} />
      <circle cx="33" cy="20.6" r="3" fill={color} />
      <circle cx="33" cy="79.4" r="3" fill={color} />
      <circle cx="67" cy="20.6" r="3" fill={color} />
    </svg>
  );
}
