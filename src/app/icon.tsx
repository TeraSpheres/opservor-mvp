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
        {/* Top hemisphere edges */}
        <line x1="20" y1="4.2" x2="27.1" y2="8.6" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="20" y1="4.2" x2="12.9" y2="8.6" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="27.1" y1="8.6" x2="31.4" y2="16.1" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="12.9" y1="8.6" x2="8.6" y2="16.1" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="27.1" y1="8.6" x2="20" y2="14.2" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="12.9" y1="8.6" x2="20" y2="14.2" stroke={BRAND_BLUE} strokeWidth="1" />

        {/* Upper middle band */}
        <line x1="31.4" y1="16.1" x2="35.1" y2="24.8" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="8.6" y1="16.1" x2="4.9" y2="24.8" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="31.4" y1="16.1" x2="24.5" y2="19.8" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="8.6" y1="16.1" x2="15.5" y2="19.8" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="20" y1="14.2" x2="24.5" y2="19.8" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="20" y1="14.2" x2="15.5" y2="19.8" stroke={BRAND_BLUE} strokeWidth="1" />

        {/* Equatorial band */}
        <line x1="35.1" y1="24.8" x2="31.4" y2="33.5" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="4.9" y1="24.8" x2="8.6" y2="33.5" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="35.1" y1="24.8" x2="24.5" y2="29.2" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="4.9" y1="24.8" x2="15.5" y2="29.2" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="24.5" y1="19.8" x2="24.5" y2="29.2" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="15.5" y1="19.8" x2="15.5" y2="29.2" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="24.5" y1="29.2" x2="20" y2="34.7" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="15.5" y1="29.2" x2="20" y2="34.7" stroke={BRAND_BLUE} strokeWidth="1" />

        {/* Lower hemisphere edges */}
        <line x1="31.4" y1="33.5" x2="20" y2="38.2" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="8.6" y1="33.5" x2="20" y2="38.2" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="31.4" y1="33.5" x2="27.1" y2="31.4" stroke={BRAND_BLUE} strokeWidth="1" />
        <line x1="8.6" y1="33.5" x2="12.9" y2="31.4" stroke={BRAND_BLUE} strokeWidth="1" />

        {/* Interior structural edges */}
        <line x1="24.5" y1="19.8" x2="31.4" y2="16.1" stroke={BRAND_BLUE} strokeWidth="0.8" opacity="0.6" />
        <line x1="15.5" y1="19.8" x2="8.6" y2="16.1" stroke={BRAND_BLUE} strokeWidth="0.8" opacity="0.6" />
        <line x1="24.5" y1="29.2" x2="35.1" y2="24.8" stroke={BRAND_BLUE} strokeWidth="0.8" opacity="0.55" />
        <line x1="15.5" y1="29.2" x2="4.9" y2="24.8" stroke={BRAND_BLUE} strokeWidth="0.8" opacity="0.55" />
      </svg>
    ),
    { ...size }
  );
}
