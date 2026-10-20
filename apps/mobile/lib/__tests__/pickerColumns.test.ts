import { describe, expect, it } from "vitest";
import { pickerColumns, ROW_BASIS } from "../pickerColumns";

// RN's iOS fontScale for each text size (RCTAccessibilityManager).
const IOS_SIZES = {
  xSmall: 0.823,
  small: 0.882,
  medium: 0.941,
  large: 1.0,
  xLarge: 1.118,
  xxLarge: 1.235,
  xxxLarge: 1.353,
  ax1: 1.786,
  ax2: 2.143,
  ax3: 2.643,
  ax4: 3.143,
  ax5: 3.571,
};

// The form card's inner width at 375pt and the gap between cards.
const ROW = 279;
const GAP = 8;

// Width a card's text gets with n cards per row; `inset` is the card's border
// plus horizontal padding on both sides (mesa 20, fichas 12).
function textWidth(n: number, inset: number): number {
  return (ROW - GAP * (n - 1)) / n - inset;
}

// Widest single words at the default size (SF Pro, points): "Quisqueya" at
// 12pt bold (mesa title) and 10pt bold (fichas name), "nacional" at 10pt
// (mesa description).
const MESA_TITLE = 63.57;
const FICHAS_NAME = 54.03;
const MESA_DESC = 40.15;
// "puntos" at 12pt bold, the longest word on the mode and score pairs.
const PAIR_TITLE = 41.96;
const FICHAS_MIN_SCALE = 0.75;

describe("pickerColumns", () => {
  it("keeps 3 tables and 4 tile sets per row at and below the default size", () => {
    for (const s of [IOS_SIZES.xSmall, IOS_SIZES.small, IOS_SIZES.medium, IOS_SIZES.large]) {
      expect(pickerColumns(s)).toEqual({ mesa: 3, fichas: 4, pair: 2 });
    }
  });

  it("gives 2 per row from XL through AX1", () => {
    for (const s of [IOS_SIZES.xLarge, IOS_SIZES.xxLarge, IOS_SIZES.xxxLarge, IOS_SIZES.ax1]) {
      expect(pickerColumns(s)).toEqual({ mesa: 2, fichas: 2, pair: 2 });
    }
  });

  it("gives 1 per row from AX2 up", () => {
    for (const s of [IOS_SIZES.ax2, IOS_SIZES.ax3, IOS_SIZES.ax4, IOS_SIZES.ax5]) {
      expect(pickerColumns(s)).toMatchObject({ mesa: 1, fichas: 1 });
    }
  });

  it("fits the widest word in one line at every scale up to 4", () => {
    for (let s = 0.8; s <= 4; s += 0.01) {
      const { mesa, fichas } = pickerColumns(s);
      const mesaWidth = textWidth(mesa, 20);
      expect(MESA_TITLE * s).toBeLessThanOrEqual(mesaWidth);
      expect(MESA_DESC * s).toBeLessThanOrEqual(mesaWidth);
      expect(FICHAS_NAME * FICHAS_MIN_SCALE * s).toBeLessThanOrEqual(textWidth(fichas, 12));
    }
  });

  it("keeps the mode and score pairs side by side through AX3 and stacks them from AX4", () => {
    expect(pickerColumns(IOS_SIZES.ax3).pair).toBe(2);
    expect(pickerColumns(IOS_SIZES.ax4).pair).toBe(1);
    expect(pickerColumns(IOS_SIZES.ax5).pair).toBe(1);
  });

  it("never breaks a word on the mode and score pairs", () => {
    for (let s = 0.8; s <= 4.0; s += 0.01) {
      expect(PAIR_TITLE * s).toBeLessThanOrEqual(textWidth(pickerColumns(s).pair, 20));
    }
  });

  it("shows fichas names unshrunk whenever the pickers leave the default layout", () => {
    for (let s = 1.07; s <= 4; s += 0.01) {
      const { fichas } = pickerColumns(s);
      expect(FICHAS_NAME * s).toBeLessThanOrEqual(textWidth(fichas, 12));
    }
  });
});

describe("ROW_BASIS", () => {
  // Inner widths of the form card on 320, 375, 393 and 440pt screens.
  it.each([224, 279, 297, 344])("puts n cards on a %dpt row", (row) => {
    for (const [n, basis] of Object.entries(ROW_BASIS)) {
      const cards = Number(n);
      const b = (parseFloat(basis) / 100) * row;
      expect(cards * b + GAP * (cards - 1)).toBeLessThanOrEqual(row);
      expect((cards + 1) * b + GAP * cards).toBeGreaterThan(row);
    }
  });

  it("keeps the original default bases", () => {
    expect(ROW_BASIS[3]).toBe("30%");
    expect(ROW_BASIS[4]).toBe("22%");
  });
});
