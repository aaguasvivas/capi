import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          board: "var(--board-bg)",
          felt: "var(--board-felt)",
          page: "var(--page-bg)",
          score: "var(--score-bg)",
          "score-text": "var(--score-text)",
          accent: "var(--accent)",
          "accent-light": "var(--accent-light)",
          hand: "var(--hand-bg)",
        },
      },
      animation: {
        "callout-enter":
          "callout-enter 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "fade-in": "fade-in 0.3s ease-out forwards",
        "slide-up": "slide-up 0.3s ease-out forwards",
        "tile-enter": "tile-enter 0.35s ease-out both",
        "turn-glow": "turn-glow 2s ease-in-out infinite",
        "score-pop": "score-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "confetti": "confetti 1s ease-out forwards",
        "toast-in": "toast-in 0.3s ease-out forwards",
        "toast-out": "toast-out 0.3s ease-in forwards",
        "chat-tray-in": "chat-tray-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "chat-bubble-in": "chat-bubble-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "chat-bubble-out": "chat-bubble-out 0.3s ease-in forwards",
        "emote-pop": "emote-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      },
      keyframes: {
        "callout-enter": {
          "0%": {
            transform: "scale(0.3) rotate(-5deg)",
            opacity: "0",
          },
          "60%": {
            transform: "scale(1.08) rotate(1deg)",
            opacity: "1",
          },
          "100%": {
            transform: "scale(1) rotate(0deg)",
            opacity: "1",
          },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "tile-enter": {
          "0%": { transform: "translateY(-20px) scale(0.8)", opacity: "0" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        "turn-glow": {
          "0%, 100%": { boxShadow: "inset 0 0 0 0 transparent" },
          "50%": { boxShadow: "inset 0 0 20px 0 var(--accent-light)" },
        },
        "score-pop": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.3)" },
          "100%": { transform: "scale(1)" },
        },
        "confetti": {
          "0%": { transform: "translateY(0) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(120px) rotate(720deg)", opacity: "0" },
        },
        "toast-in": {
          "0%": { transform: "translateY(-20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "toast-out": {
          "0%": { transform: "translateY(0)", opacity: "1" },
          "100%": { transform: "translateY(-20px)", opacity: "0" },
        },
        "chat-tray-in": {
          "0%": { transform: "translateY(12px) scale(0.92)", opacity: "0" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        "chat-bubble-in": {
          "0%": { transform: "scale(0.5) translateY(8px)", opacity: "0" },
          "70%": { transform: "scale(1.08) translateY(-2px)", opacity: "1" },
          "100%": { transform: "scale(1) translateY(0)", opacity: "1" },
        },
        "chat-bubble-out": {
          "0%": { transform: "scale(1) translateY(0)", opacity: "1" },
          "100%": { transform: "scale(0.85) translateY(-6px)", opacity: "0" },
        },
        "emote-pop": {
          "0%": { transform: "scale(0.2) rotate(-15deg)", opacity: "0" },
          "60%": { transform: "scale(1.3) rotate(5deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
