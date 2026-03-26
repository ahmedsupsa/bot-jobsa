import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#070b17",
        panel: "#101934",
        line: "#2b3f73",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(93,167,255,0.15), 0 12px 30px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
