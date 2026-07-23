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
        <line x1="20" y1="3" x2="26" y2="10" stroke={BRAND_BLUE} strokeWidth="0.9" />
        <line x1="20" y1="3" x2="14" y2="10" stroke={BRAND_BLUE} strokeWidth="0.9" />

        {/* Upper pentagon outline */}
        <line x1="26" y1="10" x2="32" y2="16" stroke={BRAND_BLUE} strokeWidth="0.9" />
        <line x1="14" y1="10" x2="8" y2="16" stroke={BRAND_BLUE} strokeWidth="0.9" />
        <line x1="32" y1="16" x2="28" y2="26" stroke={BRAND_BLUE} strokeWidth="0.9" />
        <line x1="8" y1="16" x2="12" y2="26" stroke={BRAND_BLUE} strokeWidth="0.9" />

        {/* Equatorial band - sides */}
        <line x1="28" y1="26" x2="20" y2="32" stroke={BRAND_BLUE} strokeWidth="0.9" />
        <line x1="12" y1="26" x2="20" y2="32" stroke={BRAND_BLUE} strokeWidth="0.9" />

        {/* Lower band */}
        <line x1="20" y1="32" x2="24" y2="36" stroke={BRAND_BLUE} strokeWidth="0.9" />
        <line x1="20" y1="32" x2="16" y2="36" stroke={BRAND_BLUE} strokeWidth="0.9" />

        {/* Bottom vertex connection */}
        <line x1="24" y1="36" x2="20" y2="38" stroke={BRAND_BLUE} strokeWidth="0.9" />
        <line x1="16" y1="36" x2="20" y2="38" stroke={BRAND_BLUE} strokeWidth="0.9" />

        {/* Connecting cross edges - minimal */}
        <line x1="26" y1="10" x2="32" y2="16" stroke={BRAND_BLUE} strokeWidth="0.7" opacity="0.5" />
        <line x1="14" y1="10" x2="8" y2="16" stroke={BRAND_BLUE} strokeWidth="0.7" opacity="0.5" />
      </svg>
    ),
    { ...size }
  );
}
