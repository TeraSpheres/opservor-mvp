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
      aria-label="Opservor DNA logo"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <path id="helix-left" d="M 35 10 Q 30 25, 35 40 Q 40 55, 35 70 Q 30 85, 35 95" />
        <path id="helix-right" d="M 65 10 Q 70 25, 65 40 Q 60 55, 65 70 Q 70 85, 65 95" />
      </defs>

      <use href="#helix-left" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <use href="#helix-right" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />

      <circle cx="35" cy="15" r="2.5" fill={color} />
      <circle cx="42" cy="25" r="2.5" fill={color} />
      <circle cx="50" cy="32" r="2.5" fill={color} />
      <circle cx="58" cy="25" r="2.5" fill={color} />
      <circle cx="65" cy="15" r="2.5" fill={color} />

      <circle cx="65" cy="45" r="2.5" fill={color} />
      <circle cx="58" cy="55" r="2.5" fill={color} />
      <circle cx="50" cy="62" r="2.5" fill={color} />
      <circle cx="42" cy="55" r="2.5" fill={color} />
      <circle cx="35" cy="45" r="2.5" fill={color} />

      <circle cx="35" cy="75" r="2.5" fill={color} />
      <circle cx="42" cy="85" r="2.5" fill={color} />
      <circle cx="50" cy="92" r="2.5" fill={color} />
      <circle cx="58" cy="85" r="2.5" fill={color} />
      <circle cx="65" cy="75" r="2.5" fill={color} />

      <line x1="35" y1="15" x2="42" y2="25" stroke={color} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />
      <line x1="42" y1="25" x2="50" y2="32" stroke={color} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />
      <line x1="50" y1="32" x2="58" y2="25" stroke={color} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />
      <line x1="58" y1="25" x2="65" y2="15" stroke={color} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />

      <line x1="65" y1="45" x2="58" y2="55" stroke={color} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />
      <line x1="58" y1="55" x2="50" y2="62" stroke={color} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />
      <line x1="50" y1="62" x2="42" y2="55" stroke={color} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />
      <line x1="42" y1="55" x2="35" y2="45" stroke={color} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />

      <line x1="35" y1="75" x2="42" y2="85" stroke={color} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />
      <line x1="42" y1="85" x2="50" y2="92" stroke={color} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />
      <line x1="50" y1="92" x2="58" y2="85" stroke={color} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />
      <line x1="58" y1="85" x2="65" y2="75" stroke={color} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />
    </svg>
  );
}
