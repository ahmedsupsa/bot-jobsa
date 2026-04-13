import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#060b18",
        sidebar: "#080f20",
        panel: "#0d1628",
        panel2: "#111e38",
        line: "#1a2d52",
        accent: "#4f8ef7",
        "accent-dim": "#2563eb",
        "accent-glow": "rgba(79,142,247,0.15)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(79,142,247,0.1), 0 8px 32px rgba(0,0,0,0.5)",
        card: "0 2px 16px rgba(0,0,0,0.4)",
        sidebar: "1px 0 0 rgba(26,45,82,0.8)",
      },
    },
  },
  plugins: [],
};

export default config;
