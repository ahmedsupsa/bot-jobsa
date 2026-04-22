import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        sidebar: "var(--surface)",
        panel: "var(--bg2)",
        panel2: "var(--surface2)",
        line: "var(--border)",
        line2: "var(--border2)",
        accent: "var(--accent)",
        "accent-fg": "var(--accent-fg)",
        "accent-dim": "var(--text2)",
        "accent-glow": "var(--surface2)",
        muted: "var(--text3)",
        muted2: "var(--text4)",
        ink: "var(--text)",
        ink2: "var(--text2)",
        danger: "var(--danger)",
        "danger-bg": "var(--danger-bg)",
        "danger-border": "var(--danger-border)",
      },
      boxShadow: {
        glow: "var(--shadow)",
        card: "var(--shadow)",
        sidebar: "var(--shadow)",
      },
    },
  },
  plugins: [],
};

export default config;
