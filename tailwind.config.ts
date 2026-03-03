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
        barberia: {
          accent: "#8B4513",
          surface: "#f5f0e8",
          muted: "#d4c4a8",
        },
        colmado: {
          accent: "#228B22",
          surface: "#f8f9fa",
          muted: "#c8e6c9",
        },
        patio: {
          accent: "#CD853F",
          surface: "#faf8f5",
          muted: "#e8dcc8",
        },
      },
    },
  },
  plugins: [],
};

export default config;
