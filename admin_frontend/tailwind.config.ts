import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0a",
        sidebar: "#111111",
        panel: "#141414",
        panel2: "#1a1a1a",
        line: "#2a2a2a",
        accent: "#ffffff",
        "accent-dim": "#cccccc",
        "accent-glow": "rgba(255,255,255,0.06)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.6)",
        card: "0 2px 16px rgba(0,0,0,0.5)",
        sidebar: "1px 0 0 rgba(42,42,42,0.8)",
      },
    },
  },
  plugins: [],
};

export default config;
