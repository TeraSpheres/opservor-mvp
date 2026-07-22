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
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="50" cy="50" r="34" fill="none" stroke={BRAND_BLUE} strokeWidth="6" />
        <ellipse
          cx="50"
          cy="50"
          rx="34"
          ry="12"
          fill="none"
          stroke={BRAND_BLUE}
          strokeWidth="5"
          transform="rotate(0 50 50)"
        />
        <ellipse
          cx="50"
          cy="50"
          rx="34"
          ry="12"
          fill="none"
          stroke={BRAND_BLUE}
          strokeWidth="5"
          transform="rotate(60 50 50)"
        />
        <ellipse
          cx="50"
          cy="50"
          rx="34"
          ry="12"
          fill="none"
          stroke={BRAND_BLUE}
          strokeWidth="5"
          transform="rotate(120 50 50)"
        />
        <circle cx="84" cy="50" r="5" fill={BRAND_BLUE} />
        <circle cx="16" cy="50" r="5" fill={BRAND_BLUE} />
        <circle cx="67" cy="79.4" r="5" fill={BRAND_BLUE} />
        <circle cx="33" cy="20.6" r="5" fill={BRAND_BLUE} />
        <circle cx="33" cy="79.4" r="5" fill={BRAND_BLUE} />
        <circle cx="67" cy="20.6" r="5" fill={BRAND_BLUE} />
      </svg>
    ),
    { ...size }
  );
}
