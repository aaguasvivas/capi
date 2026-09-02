// Generates Capi's app icon / adaptive / splash / favicon from a code-defined
// SVG mark. Requires `rsvg-convert` (brew install librsvg).
//
//   node scripts/gen-icons.mjs                     # default (corner) → assets/
//   CAPI_ICON=slam node scripts/gen-icons.mjs      # single slammed capicúa tile
//   CAPI_ICON=cmark node scripts/gen-icons.mjs     # gold C monogram + tile
//   OUT_DIR=/tmp/x node scripts/gen-icons.mjs      # render elsewhere (previews)
//
// Design language: sibling of Anota's icon (framed, deep field, colored pips)
// in Capi's own palette — ink field, cream tiles, barbería red + gold.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Preflight: every render below shells out to rsvg-convert.
try {
  execFileSync("which", ["rsvg-convert"], { stdio: "ignore" });
} catch {
  console.error("rsvg-convert not found. Install it with: brew install librsvg");
  process.exit(1);
}

const ASSETS = process.env.OUT_DIR ?? fileURLToPath(new URL("../assets/", import.meta.url));
mkdirSync(ASSETS, { recursive: true });

const INK = "#0a0a0a";
const CREAM = "#FBF8ED";
const TILE_EDGE = "#0f0d0a";
const GOLD = "#c9a961";
const RED = "#c0392b";
const C_SIZE = 1024;

// Pip offsets for a value within one half of a tile, on a unit grid centered
// at 0 (scaled by the half's pip spread).
const PIP_GRID = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

// A vertical domino centered at (cx, cy), long side H, rotated `rot` degrees.
// Pips: top/bottom values with independent colors. Hard offset shadow keeps
// depth without SVG filters (rsvg-safe, and the graphic long-shadow look).
function tile({
  cx,
  cy,
  W,
  H,
  rot = 0,
  top,
  bottom,
  topColor = INK,
  bottomColor = INK,
  centerGold = false,
  shadow = [26, 34],
  monochrome = false,
}) {
  const face = monochrome ? "#ffffff" : CREAM;
  const edge = monochrome ? "#ffffff" : TILE_EDGE;
  const x = cx - W / 2;
  const y = cy - H / 2;
  const rad = W * 0.17;
  const pipR = W * 0.105;
  const spread = W * 0.24;
  const half = H / 2;
  const pips = (value, hcy, color) =>
    (PIP_GRID[value] ?? [])
      .map(([gx, gy], i) => {
        const isCenter = gx === 0 && gy === 0;
        const fill = monochrome ? "#ffffff" : isCenter && centerGold ? GOLD : color;
        return `<circle cx="${(cx + gx * spread).toFixed(1)}" cy="${(hcy + gy * spread).toFixed(1)}" r="${pipR.toFixed(1)}" fill="${fill}"/>`;
      })
      .join("");
  const shadowRect = monochrome
    ? ""
    : `<rect x="${(x + shadow[0]).toFixed(1)}" y="${(y + shadow[1]).toFixed(1)}" width="${W}" height="${H}" rx="${rad.toFixed(1)}" fill="#000000" fill-opacity="0.38"/>`;
  return `
    <g transform="rotate(${rot} ${cx} ${cy})">
      ${shadowRect}
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${W}" height="${H}" rx="${rad.toFixed(1)}"
        fill="${face}" stroke="${edge}" stroke-width="${(W * 0.075).toFixed(1)}"/>
      <line x1="${(x + W * 0.13).toFixed(1)}" y1="${cy}" x2="${(x + W * 0.87).toFixed(1)}" y2="${cy}"
        stroke="${edge}" stroke-width="${(W * 0.05).toFixed(1)}" stroke-linecap="round"/>
      ${pips(top, cy - half / 2 - W * 0.02, topColor)}
      ${pips(bottom, cy + half / 2 + W * 0.02, bottomColor)}
    </g>`;
}

// "La Capicúa": the snake corner — a red-pipped double and a gold-tipped
// horizontal tile meeting in the L every Capi table produces. Bleeds slightly
// off-canvas for energy.
function cornerMark(monochrome = false) {
  return (
    tile({
      cx: 400, cy: 430, W: 260, H: 500,
      top: 5, bottom: 5,
      topColor: monochrome ? "#ffffff" : RED,
      bottomColor: monochrome ? "#ffffff" : RED,
      monochrome,
    }) +
    tile({
      cx: 792, cy: 555, W: 260, H: 500, rot: 90,
      top: 6, bottom: 4,
      centerGold: true,
      shadow: [34, 26],
      monochrome,
    })
  );
}

// "El Slam": one big capicúa tile mid-slam — red crown, gold base.
function slamMark(monochrome = false) {
  return tile({
    cx: 512, cy: 522, W: 430, H: 830, rot: -8,
    top: 5, bottom: 5,
    topColor: monochrome ? "#ffffff" : RED,
    bottomColor: monochrome ? "#ffffff" : GOLD,
    shadow: [30, 42],
    monochrome,
  });
}

// "C de Capi": the wordmark's geometric C in gold holding a small tile.
function cmarkMark(monochrome = false) {
  const c = monochrome ? "#ffffff" : GOLD;
  return `
    <path d="M 640 330 A 250 250 0 1 0 640 694" fill="none"
      stroke="${c}" stroke-width="150" stroke-linecap="round"/>
    ${tile({ cx: 742, cy: 512, W: 150, H: 290, rot: -10, top: 1, bottom: 3, shadow: [16, 22], monochrome })}`;
}

// "The Classic": the original quiet mark — cream tile, ink pips, gold
// capicúa centers — with the depth pass (hard shadow, stronger presence)
// that it was missing.
function classicMark(monochrome = false) {
  return tile({
    cx: 512, cy: 516, W: 415, H: 790, rot: -8,
    top: 5, bottom: 5,
    centerGold: true,
    shadow: [26, 36],
    monochrome,
  });
}

const MARKS = { classic: classicMark, corner: cornerMark, slam: slamMark, cmark: cmarkMark };
// Adelson's pick: the classic ink-pips tile, polished. Alternatives regenerate
// with CAPI_ICON=slam|corner|cmark. CAPI_RING=0 drops the gold frame.
const DEFAULT_VARIANT = "classic";

function svg({ variant, bg, scale = 1, monochrome = false, ring = true }) {
  const defs = `
    <radialGradient id="lift" cx="50%" cy="36%" r="80%">
      <stop offset="0%" stop-color="#1b150f"/>
      <stop offset="100%" stop-color="${INK}"/>
    </radialGradient>
    <radialGradient id="glow" cx="72%" cy="20%" r="62%">
      <stop offset="0%" stop-color="#FFC878" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="#FFC878" stop-opacity="0"/>
    </radialGradient>`;
  const frame =
    bg && ring && process.env.CAPI_RING !== "0" && variant !== "cmark"
      ? `<rect x="44" y="44" width="${C_SIZE - 88}" height="${C_SIZE - 88}" rx="180" fill="none"
           stroke="${GOLD}" stroke-opacity="0.5" stroke-width="7"/>`
      : "";
  const background = bg
    ? `<rect width="${C_SIZE}" height="${C_SIZE}" fill="url(#lift)"/>
       <rect width="${C_SIZE}" height="${C_SIZE}" fill="url(#glow)"/>
       ${frame}`
    : "";
  const body = MARKS[variant](monochrome);
  const scaled =
    scale === 1
      ? body
      : `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${body}</g>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${C_SIZE}" height="${C_SIZE}" viewBox="0 0 ${C_SIZE} ${C_SIZE}">
  <defs>${defs}</defs>
  ${background}
  ${scaled}
</svg>`;
}

function render(svgStr, outName, size, bgColor) {
  const dir = mkdtempSync(join(tmpdir(), "capi-icon-"));
  const inFile = join(dir, "in.svg");
  writeFileSync(inFile, svgStr);
  const args = ["-w", String(size), "-h", String(size)];
  if (bgColor) args.push("-b", bgColor); // flatten → opaque pixels (App Store icon)
  args.push(inFile, "-o", join(ASSETS, outName));
  execFileSync("rsvg-convert", args);
  rmSync(dir, { recursive: true, force: true });
  console.log("wrote", join(ASSETS, outName), `${size}px`);
}

const variant = MARKS[process.env.CAPI_ICON] ? process.env.CAPI_ICON : DEFAULT_VARIANT;

// Opaque, full-bleed ink:
const iconSvg = svg({ variant, bg: true });
render(iconSvg, "icon.png", 1024, INK);
render(iconSvg, "favicon.png", 64, INK);

// Transparent marks: Android adaptive foreground (safe zone) + splash.
render(svg({ variant, bg: false, scale: 0.68 }), "adaptive-icon.png", 1024);
render(svg({ variant, bg: false, scale: 0.6 }), "splash-icon.png", 1024);

// Android 13+ themed icon: all-white silhouette of the same mark.
render(svg({ variant, bg: false, scale: 0.68, monochrome: true }), "android-icon-monochrome.png", 1024);

// Version-control the icon source.
writeFileSync(join(ASSETS, "icon.svg"), iconSvg);
console.log("wrote", join(ASSETS, "icon.svg"), `(variant: ${variant})`);
