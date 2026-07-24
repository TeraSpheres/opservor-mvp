import { ImageResponse } from "next/og";

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
        {/* Top vertex */}
        <circle cx="20" cy="3.5" r="1" fill={BRAND_BLUE} />

        {/* Upper ring (5 vertices) */}
        <circle cx="27.5" cy="8.5" r="1" fill={BRAND_BLUE} />
        <circle cx="32" cy="15" r="1" fill={BRAND_BLUE} />
        <circle cx="26" cy="22" r="1" fill={BRAND_BLUE} />
        <circle cx="14" cy="22" r="1" fill={BRAND_BLUE} />
        <circle cx="8" cy="15" r="1" fill={BRAND_BLUE} />
        <circle cx="12.5" cy="8.5" r="1" fill={BRAND_BLUE} />

        {/* Middle ring (10 vertices) */}
        <circle cx="30" cy="25" r="1" fill={BRAND_BLUE} />
        <circle cx="20" cy="28" r="1" fill={BRAND_BLUE} />
        <circle cx="10" cy="25" r="1" fill={BRAND_BLUE} />
        <circle cx="28" cy="32" r="1" fill={BRAND_BLUE} />
        <circle cx="20" cy="35" r="1" fill={BRAND_BLUE} />
        <circle cx="12" cy="32" r="1" fill={BRAND_BLUE} />

        {/* Bottom vertices */}
        <circle cx="20" cy="37" r="1" fill={BRAND_BLUE} />

        {/* Upper edges */}
        <line x1="20" y1="3.5" x2="27.5" y2="8.5" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="20" y1="3.5" x2="12.5" y2="8.5" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="27.5" y1="8.5" x2="32" y2="15" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="12.5" y1="8.5" x2="8" y2="15" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="32" y1="15" x2="26" y2="22" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="8" y1="15" x2="14" y2="22" stroke={BRAND_BLUE} strokeWidth="0.7" />

        {/* Middle triangle edges */}
        <line x1="26" y1="22" x2="14" y2="22" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="26" y1="22" x2="30" y2="25" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="14" y1="22" x2="10" y2="25" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="30" y1="25" x2="20" y2="28" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="10" y1="25" x2="20" y2="28" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="26" y1="22" x2="20" y2="28" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="14" y1="22" x2="20" y2="28" stroke={BRAND_BLUE} strokeWidth="0.7" />

        {/* Lower edges */}
        <line x1="30" y1="25" x2="28" y2="32" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="20" y1="28" x2="20" y2="35" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="10" y1="25" x2="12" y2="32" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="28" y1="32" x2="20" y2="35" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="12" y1="32" x2="20" y2="35" stroke={BRAND_BLUE} strokeWidth="0.7" />
        <line x1="20" y1="35" x2="20" y2="37" stroke={BRAND_BLUE} strokeWidth="0.7" />

        {/* Cross edges for full mesh */}
        <line x1="32" y1="15" x2="30" y2="25" stroke={BRAND_BLUE} strokeWidth="0.5" opacity="0.6" />
        <line x1="8" y1="15" x2="10" y2="25" stroke={BRAND_BLUE} strokeWidth="0.5" opacity="0.6" />
        <line x1="27.5" y1="8.5" x2="30" y2="25" stroke={BRAND_BLUE} strokeWidth="0.5" opacity="0.55" />
        <line x1="12.5" y1="8.5" x2="10" y2="25" stroke={BRAND_BLUE} strokeWidth="0.5" opacity="0.55" />
      </svg>
    ),
    { ...size }
  );
}
