// Generates the Google Play listing assets that Apple's kit doesn't need:
//   store-assets/play/feature-graphic.png  (1024×500, required by Play)
// The 512×512 Play icon is a plain sips downscale of assets/icon.png so the
// mark stays pixel-identical; see docs/RELEASE.md.
//
//   node scripts/gen-play-assets.mjs
//
// Same visual language as gen-icons.mjs "classic": ink field, warm top-right
// glow, cream tile with ink pips + gold capicúa centers, hard offset shadow.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Preflight: the render below shells out to rsvg-convert.
try {
  execFileSync("which", ["rsvg-convert"], { stdio: "ignore" });
} catch {
  console.error("rsvg-convert not found. Install it with: brew install librsvg");
  process.exit(1);
}

const OUT = fileURLToPath(new URL("../store-assets/play/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const INK = "#0a0a0a";
const CREAM = "#FBF8ED";
const TILE_EDGE = "#0f0d0a";
const GOLD = "#c9a961";
const W = 1024;
const H = 500;

const PIP_GRID = {
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
};

// Same tile() geometry as gen-icons.mjs, trimmed to what the graphic uses.
function tile({ cx, cy, TW, TH, rot, shadow }) {
  const x = cx - TW / 2;
  const y = cy - TH / 2;
  const rad = TW * 0.17;
  const pipR = TW * 0.105;
  const spread = TW * 0.24;
  const half = TH / 2;
  const pips = (hcy) =>
    PIP_GRID[5]
      .map(([gx, gy]) => {
        const isCenter = gx === 0 && gy === 0;
        return `<circle cx="${(cx + gx * spread).toFixed(1)}" cy="${(hcy + gy * spread).toFixed(1)}" r="${pipR.toFixed(1)}" fill="${isCenter ? GOLD : INK}"/>`;
      })
      .join("");
  return `
    <g transform="rotate(${rot} ${cx} ${cy})">
      <rect x="${(x + shadow[0]).toFixed(1)}" y="${(y + shadow[1]).toFixed(1)}" width="${TW}" height="${TH}" rx="${rad.toFixed(1)}" fill="#000000" fill-opacity="0.38"/>
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${TW}" height="${TH}" rx="${rad.toFixed(1)}"
        fill="${CREAM}" stroke="${TILE_EDGE}" stroke-width="${(TW * 0.075).toFixed(1)}"/>
      <line x1="${(x + TW * 0.13).toFixed(1)}" y1="${cy}" x2="${(x + TW * 0.87).toFixed(1)}" y2="${cy}"
        stroke="${TILE_EDGE}" stroke-width="${(TW * 0.05).toFixed(1)}" stroke-linecap="round"/>
      ${pips(cy - half / 2 - TW * 0.02)}
      ${pips(cy + half / 2 + TW * 0.02)}
    </g>`;
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="lift" cx="30%" cy="40%" r="90%">
      <stop offset="0%" stop-color="#1b150f"/>
      <stop offset="100%" stop-color="${INK}"/>
    </radialGradient>
    <radialGradient id="glow" cx="80%" cy="14%" r="55%">
      <stop offset="0%" stop-color="#FFC878" stop-opacity="0.24"/>
      <stop offset="100%" stop-color="#FFC878" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#lift)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${tile({ cx: 205, cy: 258, TW: 200, TH: 380, rot: -8, shadow: [13, 18] })}
  <text x="400" y="272" font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
    font-size="180" font-weight="800" fill="${CREAM}">Capi</text>
  <rect x="406" y="300" width="150" height="10" rx="5" fill="${GOLD}"/>
  <text x="400" y="368" font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
    font-size="36" font-weight="700" letter-spacing="9" fill="${GOLD}">DOMINÓ DOMINICANO</text>
  <text x="400" y="428" font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
    font-size="30" font-style="italic" fill="${CREAM}" fill-opacity="0.75">Como en el patio.</text>
</svg>`;

const dir = mkdtempSync(join(tmpdir(), "capi-play-"));
const inFile = join(dir, "feature.svg");
writeFileSync(inFile, svg);
execFileSync("rsvg-convert", ["-w", String(W), "-h", String(H), "-b", INK, inFile, "-o", join(OUT, "feature-graphic.png")]);
rmSync(dir, { recursive: true, force: true });
writeFileSync(join(OUT, "feature-graphic.svg"), svg);
console.log("wrote", join(OUT, "feature-graphic.png"), `${W}x${H}`);
