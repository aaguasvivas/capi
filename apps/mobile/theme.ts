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
    handText: "#4b5563",
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
    handText: "#4b5563",
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
    handText: "#4b5563",
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

// Label inks for text drawn on a filled accent (buttons, chips, pills).
export const INK_DARK = "#111827";
export const INK_LIGHT = "#ffffff";

// WCAG relative luminance of a #rrggbb color.
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1, 7), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Label color on a fill: whichever of the two inks contrasts more. White
// wins on the red accent, dark ink on gold, terracotta and teal. Where
// neither reaches body-text contrast, pure black may: Noche's indigo gives
// white 4.47:1 and black 4.70:1, the ink the web uses there.
export function inkOn(fill: string): string {
  const ink =
    contrast(INK_DARK, fill) >= contrast(INK_LIGHT, fill) ? INK_DARK : INK_LIGHT;
  return contrast(ink, fill) < 4.5 && contrast("#000000", fill) > contrast(ink, fill)
    ? "#000000"
    : ink;
}

// Accent-colored text where the accent reads on the background at the given
// ratio (4.5 for body text, 3 for large bold), otherwise the fallback ink.
export function accentTextOn(
  accent: string,
  bg: string,
  fallback: string,
  min: number
): string {
  return contrast(accent, bg) >= min ? accent : fallback;
}

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
