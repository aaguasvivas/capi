export interface ThemePalette {
  pageBg: string;
  feltCenter: string;
  feltMid: string;
  feltEdge: string;
  scoreBg: string;
  scoreText: string;
  accent: string;
  handBg: string;
  handText: string;
  watermark: string;
}

export const THEMES: Record<
  "barberia" | "colmado" | "patio" | "quisqueya" | "larimar" | "noche",
  ThemePalette
> = {
  barberia: {
    pageBg: "#f5f0e8",
    feltCenter: "#2e8a4e",
    feltMid: "#1a5c2e",
    feltEdge: "#0e3a1a",
    scoreBg: "#2a1210",
    scoreText: "#f5f0e8",
    accent: "#c0392b",
    handBg: "#ebe4d4",
    handText: "#6b7280",
    watermark: "BARBERÍA DON RAMÓN",
  },
  colmado: {
    pageBg: "#f5e6c8",
    feltCenter: "#4a3828",
    feltMid: "#3a2a1a",
    feltEdge: "#2a1e12",
    scoreBg: "#4a3520",
    scoreText: "#f5e6c8",
    accent: "#d4a017",
    handBg: "#f0dcc0",
    handText: "#6b7280",
    watermark: "COLMADO LA ESQUINA",
  },
  patio: {
    pageBg: "#e8d5c0",
    feltCenter: "#8a8278",
    feltMid: "#7a7268",
    feltEdge: "#5f574d",
    scoreBg: "#5a4a3a",
    scoreText: "#f0ebe3",
    accent: "#c4693d",
    handBg: "#e0ceb8",
    handText: "#6b7280",
    watermark: "EL PATIO DE TÍA",
  },
  quisqueya: {
    pageBg: "#eef1f6",
    feltCenter: "#1d4380",
    feltMid: "#0f2b56",
    feltEdge: "#081a38",
    scoreBg: "#0a1f3f",
    scoreText: "#eef1f6",
    accent: "#c9a227",
    handBg: "#e2e8f2",
    handText: "#5a6577",
    watermark: "QUISQUEYA LA BELLA",
  },
  larimar: {
    pageBg: "#e9f2f3",
    feltCenter: "#2a7d8e",
    feltMid: "#17606f",
    feltEdge: "#0d3d47",
    scoreBg: "#0d3d47",
    scoreText: "#e9f2f3",
    accent: "#58b7c4",
    handBg: "#d9e9eb",
    handText: "#4e6b70",
    watermark: "LARIMAR",
  },
  noche: {
    pageBg: "#15152b",
    feltCenter: "#23234a",
    feltMid: "#131329",
    feltEdge: "#0a0a18",
    scoreBg: "#0a0a18",
    scoreText: "#e6e6f5",
    accent: "#6366f1",
    handBg: "#1d1d3a",
    handText: "#a5a8c9",
    watermark: "CAPI NOCHE",
  },
};

export function getTheme(name?: string): ThemePalette {
  return THEMES[name as keyof typeof THEMES] ?? THEMES.barberia;
}

// Static barberia-flavored theme. Screens without a game theme (landing,
// waiting room) keep using this; tile colors live in lib/tileSkins.
export const THEME = {
  pageBg: "#f5f0e8",
  feltCenter: "#2e8a4e",
  feltMid: "#1a5c2e",
  feltEdge: "#0e3a1a",
  scoreBg: "#2a1210",
  scoreText: "#f5f0e8",
  accent: "#c0392b",
  handBg: "#ebe4d4",
};

export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? "https://playcapi.com";
