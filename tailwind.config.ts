import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",
        panel: "#FFFFFF",
        surface: "#F6F7FB",
        border: "#E4E7EE",
        muted: "#64748B",
        brand: {
          DEFAULT: "#2F3B52",
          light: "#3E4E6B",
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
