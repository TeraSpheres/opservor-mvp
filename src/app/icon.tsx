import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const BRAND_BLUE = "#3B82F6";

export default function Icon() {
  return new ImageResponse(
    (
      <svg
        width={32}
        height={32}
        viewBox="0 0 40 40"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Edges - thin lines */}
        <line x1="20" y1="4" x2="28" y2="10" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="20" y1="4" x2="12" y2="10" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="28" y1="10" x2="34" y2="18" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="12" y1="10" x2="6" y2="18" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="28" y1="10" x2="26" y2="20" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="12" y1="10" x2="14" y2="20" stroke={BRAND_BLUE} strokeWidth="0.7" />

        <line x1="34" y1="18" x2="32" y2="28" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="6" y1="18" x2="8" y2="28" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="26" y1="20" x2="32" y2="28" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="14" y1="20" x2="8" y2="28" stroke={BRAND_BLUE} strokeWidth="0.7" />

        <line x1="20" y1="16" x2="26" y2="20" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="20" y1="16" x2="14" y2="20" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="20" y1="16" x2="32" y2="28" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="20" y1="16" x2="8" y2="28" stroke={BRAND_BLUE} strokeWidth="0.7" />

        <line x1="32" y1="28" x2="24" y2="35" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="8" y1="28" x2="16" y2="35" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="24" y1="35" x2="16" y2="35" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="20" y1="16" x2="24" y2="35" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="20" y1="16" x2="16" y2="35" stroke={BRAND_BLUE} strokeWidth="0.7" />

        {/* Vertices - nodes/dots */}
        <circle cx="20" cy="4" r="1.5" fill={BRAND_BLUE} />
        <circle cx="28" cy="10" r="1.5" fill={BRAND_BLUE} />
        <circle cx="12" cy="10" r="1.5" fill={BRAND_BLUE} />
        <circle cx="34" cy="18" r="1.5" fill={BRAND_BLUE} />
        <circle cx="6" cy="18" r="1.5" fill={BRAND_BLUE} />
        <circle cx="26" cy="20" r="1.5" fill={BRAND_BLUE} />
        <circle cx="14" cy="20" r="1.5" fill={BRAND_BLUE} />
        <circle cx="20" cy="16" r="1.2" fill={BRAND_BLUE} />
        <circle cx="32" cy="28" r="1.5" fill={BRAND_BLUE} />
        <circle cx="8" cy="28" r="1.5" fill={BRAND_BLUE} />
        <circle cx="24" cy="35" r="1.5" fill={BRAND_BLUE} />
        <circle cx="16" cy="35" r="1.5" fill={BRAND_BLUE} />
      </svg>
    ),
    { ...size }
  );
}
