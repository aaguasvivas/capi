// Generates Capi's app icon / adaptive / splash / favicon from a code-defined
// SVG mark. Requires `rsvg-convert` (brew install librsvg).
//
//   node scripts/gen-icons.mjs                    # default (tile) mark → assets/
//   CAPI_ICON=letter node scripts/gen-icons.mjs   # geometric C variant
//   OUT_DIR=/tmp/x node scripts/gen-icons.mjs     # render elsewhere (previews)
//
// Brand tokens come from the shipped web mark (apps/web/src/app/icon.tsx and
// opengraph-image.tsx): ink field, cream glyph, gold pip. Anota (the sibling
// app) owns green felt + gold ring; Capi stays ink + cream + gold.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ASSETS = process.env.OUT_DIR ?? fileURLToPath(new URL("../assets/", import.meta.url));
mkdirSync(ASSETS, { recursive: true });

const INK = "#0a0a0a";
const CREAM = "#f5f0e8";
const TILE_FACE = "#fafaf7";
const GOLD = "#c9a961";
const C_SIZE = 1024;

// The web favicon grown up: a geometric bold "C" (thick round-capped arc,
// opening to the right) with the gold pip floating at the top-right, same
// composition as apps/web/src/app/icon.tsx.
function letterMark(color, pipColor = GOLD) {
  // Arc of a circle centered (500,540) r=270, gap facing right (±55°).
  return `
    <path d="M 655 319 A 270 270 0 1 0 655 761" fill="none"
      stroke="${color}" stroke-width="165" stroke-linecap="round"/>
    <circle cx="780" cy="220" r="62" fill="${pipColor}"/>`;
}

// A single cream, ink-bordered domino tile (the web OG-image tile style)
// rotated like a tile mid-slam, showing 5|5 — the capicúa wink — with both
// center pips in gold.
function tileMark(monochrome = false) {
  const face = monochrome ? "#ffffff" : TILE_FACE;
  const line = monochrome ? "#ffffff" : INK;
  const pip = monochrome ? "#ffffff" : INK;
  const goldPip = monochrome ? "#ffffff" : GOLD;
  const W = 400, H = 760, x = 512 - W / 2, y = 512 - H / 2;
  const fivePips = (cy, centerFill) => {
    const d = 105, r = 40;
    let out = `<circle cx="512" cy="${cy}" r="${r}" fill="${centerFill}"/>`;
    for (const dx of [-d, d]) for (const dy of [-d, d]) {
      out += `<circle cx="${512 + dx}" cy="${cy + dy}" r="${r}" fill="${pip}"/>`;
    }
    return out;
  };
  return `
    <g transform="rotate(-8 512 512)">
      <rect x="${x}" y="${y}" width="${W}" height="${H}" rx="52"
        fill="${face}" stroke="${line}" stroke-width="20"/>
      <line x1="${x + 40}" y1="512" x2="${x + W - 40}" y2="512"
        stroke="${line}" stroke-width="22" stroke-linecap="round"/>
      ${fivePips(322, goldPip)}
      ${fivePips(702, goldPip)}
    </g>`;
}

function mark(variant, { monochrome = false } = {}) {
  if (variant === "tile") return tileMark(monochrome);
  return monochrome ? letterMark("#ffffff", "#ffffff") : letterMark(CREAM);
}

// scale: mark group scale about the canvas center (1 = full size).
// bg: ink field with a soft warm glow top-right (echoes the OG image light).
function svg({ variant, bg, scale = 1, monochrome = false }) {
  const defs = `
    <radialGradient id="lift" cx="50%" cy="38%" r="80%">
      <stop offset="0%" stop-color="#181410"/>
      <stop offset="100%" stop-color="${INK}"/>
    </radialGradient>
    <radialGradient id="glow" cx="78%" cy="16%" r="60%">
      <stop offset="0%" stop-color="#FFC878" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="#FFC878" stop-opacity="0"/>
    </radialGradient>`;
  const background = bg
    ? `<rect width="${C_SIZE}" height="${C_SIZE}" fill="url(#lift)"/>
       <rect width="${C_SIZE}" height="${C_SIZE}" fill="url(#glow)"/>`
    : "";
  const body =
    scale === 1
      ? mark(variant, { monochrome })
      : `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${mark(variant, { monochrome })}</g>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${C_SIZE}" height="${C_SIZE}" viewBox="0 0 ${C_SIZE} ${C_SIZE}">
  <defs>${defs}</defs>
  ${background}
  ${body}
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

const variant = process.env.CAPI_ICON === "letter" ? "letter" : "tile";

// Opaque, full-bleed ink:
const iconSvg = svg({ variant, bg: true });
render(iconSvg, "icon.png", 1024, INK);
render(iconSvg, "favicon.png", 64, INK);

// Transparent marks: Android adaptive foreground (safe zone) + splash.
render(svg({ variant, bg: false, scale: 0.72 }), "adaptive-icon.png", 1024);
render(svg({ variant, bg: false, scale: 0.62 }), "splash-icon.png", 1024);

// Android 13+ themed icon: all-white silhouette of the letter mark (always the
// letter — at themed-icon sizes the C reads better than a pip grid).
render(svg({ variant: "letter", bg: false, scale: 0.72, monochrome: true }), "android-icon-monochrome.png", 1024);

// Version-control the icon source.
writeFileSync(join(ASSETS, "icon.svg"), iconSvg);
console.log("wrote", join(ASSETS, "icon.svg"));
