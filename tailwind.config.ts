import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#FFFFFF",
        panel: "#1a2847",
        surface: "#0f1823",
        border: "#2d3a52",
        muted: "#8b95a8",
        brand: {
          DEFAULT: "#3B82F6",
          light: "#60a5fa",
        },
        band: {
          excellent: "#1F9D6D",
          stable: "#4C8DFF",
          watch: "#E8A72C",
          atrisk: "#E8672C",
          critical: "#D6395A",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
