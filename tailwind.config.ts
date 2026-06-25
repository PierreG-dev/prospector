import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#FAF7F2",
        mid: "#E8DDD0",
        warmDark: "#1A1208",
        accent: "#C8622A",
        accent2: "#4A7C6F",
        textMuted: "#7A6E63",
        reject: "#A63D2F",
        snooze: "#C8922A",
        // dark mode palette
        nightSurface: "#241A10",
        nightBorder: "#3A2C1C",
        nightMuted: "#A89886",
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-dm-mono)", "ui-monospace", "monospace"],
        serif: ["var(--font-dm-serif)", "Georgia", "serif"],
      },
      boxShadow: {
        warm: "0 6px 24px -8px rgba(26,18,8,0.18)",
        "warm-sm": "0 2px 8px -2px rgba(26,18,8,0.12)",
        "warm-lg": "0 14px 40px -12px rgba(26,18,8,0.22)",
      },
      borderRadius: {
        "2xl": "1rem",
      },
      transitionTimingFunction: {
        warm: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
