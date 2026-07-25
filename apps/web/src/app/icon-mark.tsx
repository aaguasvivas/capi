import type { CSSProperties } from "react";

// Shared web rendering of the app icon: the classic Capi tile (cream, tilted,
// ink pips with gold capicúa centers) on an ink field with the gold ring.
// Mirrors apps/mobile/scripts/gen-icons.mjs "classic" variant so the browser
// tab, the iOS home-screen shortcut, and the installed app all match.
// satori (next/og) has no SVG-transform support, so the tile is built from
// divs and rotated with a CSS transform.
const INK = "#0a0a0a";
const CREAM = "#FBF8ED";
const GOLD = "#c9a961";

// Pip grid within one half of the tile, in unit offsets (-1, 0, 1).
const HALF_PIPS: Array<[number, number]> = [
  [-1, -1],
  [1, -1],
  [0, 0],
  [-1, 1],
  [1, 1],
];

function Half({ size, pip, spread }: { size: number; pip: number; spread: number }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {HALF_PIPS.map(([gx, gy], i) => {
        const isCenter = gx === 0 && gy === 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: size / 2 + gx * spread - pip / 2,
              top: size / 2 + gy * spread - pip / 2,
              width: pip,
              height: pip,
              borderRadius: pip,
              background: isCenter ? GOLD : INK,
              display: "flex",
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * @param s   canvas edge in px
 * @param ring draw the gold frame (skipped at favicon sizes where it muddies)
 */
export function CapiMark({ s, ring }: { s: number; ring: boolean }) {
  const tileW = s * 0.42;
  const tileH = s * 0.8;
  const border = Math.max(2, s * 0.03);
  const pip = tileW * 0.21;
  const spread = tileW * 0.24;
  const halfSize = tileH / 2 - border;

  const frame: CSSProperties = {
    position: "absolute",
    left: s * 0.043,
    top: s * 0.043,
    width: s * 0.914,
    height: s * 0.914,
    borderRadius: s * 0.176,
    border: `${Math.max(1, s * 0.007)}px solid rgba(201,169,97,0.5)`,
    display: "flex",
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Same lift + warm top-right glow as the generated app icon.
        background: `radial-gradient(circle at 72% 20%, rgba(255,200,120,0.26), rgba(255,200,120,0) 62%), radial-gradient(circle at 50% 36%, #1b150f, ${INK} 80%)`,
        position: "relative",
      }}
    >
      {ring ? <div style={frame} /> : null}
      <div
        style={{
          width: tileW,
          height: tileH,
          background: CREAM,
          border: `${border}px solid ${INK}`,
          borderRadius: tileW * 0.17,
          display: "flex",
          flexDirection: "column",
          transform: "rotate(-8deg)",
          boxShadow: `${s * 0.025}px ${s * 0.035}px 0 rgba(0,0,0,0.38)`,
        }}
      >
        <Half size={halfSize} pip={pip} spread={spread} />
        <div
          style={{
            height: Math.max(2, s * 0.02),
            marginLeft: tileW * 0.12,
            marginRight: tileW * 0.12,
            background: INK,
            borderRadius: s * 0.02,
            display: "flex",
          }}
        />
        <Half size={halfSize} pip={pip} spread={spread} />
      </div>
    </div>
  );
}
