export interface ThemePalette {
  pageBg: string;
  feltCenter: string;
  feltMid: string;
  feltEdge: string;
  scoreBg: string;
  scoreText: string;
  accent: string;
  handBg: string;
  watermark: string;
}

export const THEMES: Record<"barberia" | "colmado" | "patio", ThemePalette> = {
  barberia: {
    pageBg: "#f5f0e8",
    feltCenter: "#2e8a4e",
    feltMid: "#1a5c2e",
    feltEdge: "#0e3a1a",
    scoreBg: "#2a1210",
    scoreText: "#f5f0e8",
    accent: "#c0392b",
    handBg: "#ebe4d4",
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
    watermark: "EL PATIO DE TÍA",
  },
};

export function getTheme(name?: string): ThemePalette {
  return THEMES[name as keyof typeof THEMES] ?? THEMES.barberia;
}

// Static barberia-flavored theme + tile constants. Screens without a game
// theme (landing, waiting room) and tile rendering keep using this.
export const THEME = {
  pageBg: "#f5f0e8",
  feltCenter: "#2e8a4e",
  feltMid: "#1a5c2e",
  feltEdge: "#0e3a1a",
  scoreBg: "#2a1210",
  scoreText: "#f5f0e8",
  accent: "#c0392b",
  handBg: "#ebe4d4",
  tileFace: "#FBF8ED",
  tileFaceDouble: "#ECE4CC",
  tileBorder: "#c8bc9e",
  tileBorderDouble: "#8a7d60",
};

export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? "https://playcapi.com";
