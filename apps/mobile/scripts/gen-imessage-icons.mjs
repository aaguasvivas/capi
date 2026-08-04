// iMessage app drawer icons: wide (letterboxed) renders of the classic mark.
// Sizes per Apple's iMessage App Icon set. Requires rsvg-convert.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(
  new URL("../targets/messages/Assets.xcassets/iMessage App Icon.stickersiconset/", import.meta.url)
);
mkdirSync(OUT, { recursive: true });

const INK = "#0a0a0a";
const CREAM = "#FBF8ED";
const GOLD = "#c9a961";
const EDGE = "#0f0d0a";
const PIPS5 = [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]];

function tileSvg(W, H) {
  // One classic tile centered in a W x H canvas, tile height = 86% of H.
  const TH = H * 0.86, TW = TH * 0.52, cx = W / 2, cy = H / 2;
  const x = cx - TW / 2, y = cy - TH / 2, rad = TW * 0.17, pipR = TW * 0.105, spread = TW * 0.24;
  const pips = (hcy) =>
    PIPS5.map(([gx, gy]) => {
      const c = gx === 0 && gy === 0 ? GOLD : INK;
      return `<circle cx="${cx + gx * spread}" cy="${hcy + gy * spread}" r="${pipR}" fill="${c}"/>`;
    }).join("");
  return `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${INK}"/>
  <g transform="rotate(-8 ${cx} ${cy})">
    <rect x="${x}" y="${y}" width="${TW}" height="${TH}" rx="${rad}" fill="${CREAM}" stroke="${EDGE}" stroke-width="${TW * 0.075}"/>
    <line x1="${x + TW * 0.13}" y1="${cy}" x2="${x + TW * 0.87}" y2="${cy}" stroke="${EDGE}" stroke-width="${TW * 0.05}" stroke-linecap="round"/>
    ${pips(cy - TH / 4 - TW * 0.02)}
    ${pips(cy + TH / 4 + TW * 0.02)}
  </g>
</svg>`;
}

const SIZES = [
  ["icon-27x20@2x.png", 54, 40], ["icon-27x20@3x.png", 81, 60],
  ["icon-32x24@2x.png", 64, 48], ["icon-32x24@3x.png", 96, 72],
  ["icon-60x45@2x.png", 120, 90], ["icon-60x45@3x.png", 180, 135],
  ["icon-67x50@2x.png", 134, 100],
  ["icon-74x55@2x.png", 148, 110],
  ["icon-1024x768.png", 1024, 768],
  ["icon-appstore-1024.png", 1024, 1024],
];

const dir = mkdtempSync(join(tmpdir(), "capi-imsg-"));
for (const [name, w, h] of SIZES) {
  const f = join(dir, name + ".svg");
  writeFileSync(f, tileSvg(w, h));
  execFileSync("rsvg-convert", ["-w", String(w), "-h", String(h), "-b", INK, f, "-o", join(OUT, name)]);
  console.log("wrote", name);
}
rmSync(dir, { recursive: true, force: true });

const contents = {
  images: [
    { size: "60x45", idiom: "iphone", filename: "icon-60x45@2x.png", scale: "2x" },
    { size: "60x45", idiom: "iphone", filename: "icon-60x45@3x.png", scale: "3x" },
    { size: "67x50", idiom: "ipad", filename: "icon-67x50@2x.png", scale: "2x" },
    { size: "74x55", idiom: "ipad", filename: "icon-74x55@2x.png", scale: "2x" },
    { size: "27x20", idiom: "universal", filename: "icon-27x20@2x.png", scale: "2x", platform: "ios" },
    { size: "27x20", idiom: "universal", filename: "icon-27x20@3x.png", scale: "3x", platform: "ios" },
    { size: "32x24", idiom: "universal", filename: "icon-32x24@2x.png", scale: "2x", platform: "ios" },
    { size: "32x24", idiom: "universal", filename: "icon-32x24@3x.png", scale: "3x", platform: "ios" },
    { size: "1024x1024", idiom: "ios-marketing", filename: "icon-appstore-1024.png", scale: "1x", platform: "ios" },
    { size: "1024x768", idiom: "ios-marketing", filename: "icon-1024x768.png", scale: "1x", platform: "ios" },
  ],
  info: { version: 1, author: "xcode" },
};
writeFileSync(join(OUT, "Contents.json"), JSON.stringify(contents, null, 2));
console.log("wrote Contents.json");
