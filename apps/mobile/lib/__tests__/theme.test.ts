import { describe, expect, it } from "vitest";
import {
  accentTextOn,
  contrast,
  FELT_LOCATIONS,
  feltColors,
  inkOn,
  INK_DARK,
  RAIL_CHIP,
  THEMES,
} from "../../theme";

// WCAG AA: 4.5:1 for body text, 3:1 for large bold text.
const BODY = 4.5;
const LARGE = 3;

// --accent-ink per theme in apps/web/src/app/globals.css.
const WEB_ACCENT_INK: Record<string, string> = {
  barberia: "#ffffff",
  colmado: "#111827",
  patio: "#111827",
  quisqueya: "#111827",
  larimar: "#111827",
  noche: "#000000",
};

// A #rrggbb or rgba(r,g,b,a) ink painted over a #rrggbb background, as hex.
function over(ink: string, bg: string): string {
  const n = parseInt(bg.slice(1, 7), 16);
  const back = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const m = ink.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/);
  if (!m) return ink;
  const a = Number(m[4]);
  return (
    "#" +
    [1, 2, 3]
      .map((i) => Math.round(a * Number(m[i]) + (1 - a) * back[i - 1]))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

describe("table text contrast", () => {
  for (const [name, p] of Object.entries(THEMES)) {
    it(`${name}: hand panel text reads on the panel`, () => {
      expect(contrast(p.handText, p.handBg)).toBeGreaterThanOrEqual(BODY);
    });

    it(`${name}: labels on the accent reach body-text contrast with the web's ink`, () => {
      const ink = inkOn(p.accent);
      expect(contrast(ink, p.accent)).toBeGreaterThanOrEqual(BODY);
      // The same ink as the web table's --accent-ink (globals.css).
      expect(ink).toBe(WEB_ACCENT_INK[name]);
    });

    it(`${name}: the opponent line and boneyard count read on the felt's top band`, () => {
      // The band is flat feltMid down to FELT_LOCATIONS[1].
      const [top, bandEnd] = feltColors(p);
      expect(top).toBe(p.feltMid);
      expect(bandEnd).toBe(p.feltMid);
      expect(FELT_LOCATIONS[1]).toBeGreaterThanOrEqual(0.1);
      expect(contrast(over(p.feltLabel, p.feltMid), p.feltMid)).toBeGreaterThanOrEqual(BODY);
      expect(contrast(over(p.feltGold, p.feltMid), p.feltMid)).toBeGreaterThanOrEqual(BODY);
    });

    it(`${name}: the 2v2 rail names and tile lines read on their chips over the light pool`, () => {
      // The rails sit level with the light pool, so feltCenter is the worst case.
      const chip = over(RAIL_CHIP, p.feltCenter);
      expect(contrast(over(p.feltLabel, chip), chip)).toBeGreaterThanOrEqual(BODY);
    });

    it(`${name}: accent text on the score panel falls back where it fails`, () => {
      const body = accentTextOn(p.accent, p.scoreBg, p.scoreText, BODY);
      const large = accentTextOn(p.accent, p.scoreBg, p.scoreText, LARGE);
      expect(contrast(body, p.scoreBg)).toBeGreaterThanOrEqual(BODY);
      expect(contrast(large, p.scoreBg)).toBeGreaterThanOrEqual(LARGE);
    });
  }

  it("the Draw label reads on its amber fill", () => {
    expect(contrast(INK_DARK, "#f59e0b")).toBeGreaterThanOrEqual(BODY);
  });
});
