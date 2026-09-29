import { describe, expect, it } from "vitest";
import { accentTextOn, contrast, inkOn, INK_DARK, THEMES } from "../../theme";

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
