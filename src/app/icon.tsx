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
        {/* Top vertex */}
        <line x1="20" y1="2" x2="24.7" y2="9" stroke={BRAND_BLUE} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="20" y1="2" x2="15.3" y2="9" stroke={BRAND_BLUE} strokeWidth="1.5" strokeLinecap="round" />

        {/* Upper left edges */}
        <line x1="15.3" y1="9" x2="8" y2="12" stroke={BRAND_BLUE} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="15.3" y1="9" x2="10" y2="20" stroke={BRAND_BLUE} strokeWidth="1.5" strokeLinecap="round" />

        {/* Upper right edges */}
        <line x1="24.7" y1="9" x2="32" y2="12" stroke={BRAND_BLUE} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="24.7" y1="9" x2="30" y2="20" stroke={BRAND_BLUE} strokeWidth="1.5" strokeLinecap="round" />

        {/* Top horizontal edges */}
        <line x1="8" y1="12" x2="32" y2="12" stroke={BRAND_BLUE} strokeWidth="1.5" strokeLinecap="round" />

        {/* Upper side edges */}
        <line x1="8" y1="12" x2="10" y2="20" stroke={BRAND_BLUE} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="32" y1="12" x2="30" y2="20" stroke={BRAND_BLUE} strokeWidth="1.5" strokeLinecap="round" />

        {/* Middle horizontal edges */}
        <line x1="10" y1="20" x2="20" y2="28" stroke={BRAND_BLUE} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="30" y1="20" x2="20" y2="28" stroke={BRAND_BLUE} strokeWidth="1.5" strokeLinecap="round" />

        {/* Lower left edges */}
        <line x1="10" y1="20" x2="6" y2="30" stroke={BRAND_BLUE} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="20" y1="28" x2="8" y2="36" stroke={BRAND_BLUE} strokeWidth="1.5" strokeLinecap="round" />

        {/* Lower right edges */}
        <line x1="30" y1="20" x2="34" y2="30" stroke={BRAND_BLUE} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="20" y1="28" x2="32" y2="36" stroke={BRAND_BLUE} strokeWidth="1.5" strokeLinecap="round" />

        {/* Bottom edges */}
        <line x1="6" y1="30" x2="8" y2="36" stroke={BRAND_BLUE} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="34" y1="30" x2="32" y2="36" stroke={BRAND_BLUE} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="8" y1="36" x2="32" y2="36" stroke={BRAND_BLUE} strokeWidth="1.5" strokeLinecap="round" />

        {/* Center vertical structure */}
        <line x1="20" y1="9" x2="20" y2="28" stroke={BRAND_BLUE} strokeWidth="1.2" opacity="0.65" strokeLinecap="round" />
        <line x1="6" y1="30" x2="34" y2="30" stroke={BRAND_BLUE} strokeWidth="1.2" opacity="0.6" strokeLinecap="round" />
      </svg>
    ),
    { ...size }
  );
}
