import type { TileSkinId } from "@/lib/tileBacks";

// Face-down tile in one of the four designs. A DOM SVG port of the app's back
// art (apps/mobile/lib/tileSkins.tsx: RdArt, PrArt, JmArt): a change to one
// needs the same change in the other. Clasico is the web's own face-down
// tile, unchanged.

interface Props {
  skin: TileSkinId;
  small?: boolean;
  // Explicit pixel size; overrides the small/large presets, as in TileDisplay.
  w?: number;
  h?: number;
}

const PREMIUM_BACKS = {
  quisqueya: { bg: "#ffffff", border: "#8a7d60" },
  borinquen: { bg: "#003087", border: "#001d52" },
  kingston: { bg: "#141414", border: "#000000" },
} as const;

// 10-vertex polygon points for a 5-point star, top point up.
function starPoints(cx: number, cy: number, outer: number): string {
  const inner = outer * 0.382;
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outer : inner;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return pts.join(" ");
}

// Full-bleed DR quadrants: blue top-left and bottom-right, red top-right and
// bottom-left, white cross from the bg, gold center dot for the shield.
function RdArt({ w, h }: { w: number; h: number }) {
  const qw = w * 0.41;
  const qh = h * 0.455;
  return (
    <>
      <rect x={0} y={0} width={qw} height={qh} fill="#002d62" />
      <rect x={w - qw} y={0} width={qw} height={qh} fill="#ce1126" />
      <rect x={0} y={h - qh} width={qw} height={qh} fill="#ce1126" />
      <rect x={w - qw} y={h - qh} width={qw} height={qh} fill="#002d62" />
      <circle cx={w / 2} cy={h / 2} r={w * 0.08} fill="#c9a227" />
    </>
  );
}

// Centered true-proportion PR flag patch. Never stretched to the tile aspect.
function PrArt({ w, h, pw, ph }: { w: number; h: number; pw: number; ph: number }) {
  const px = (w - pw) / 2;
  const py = (h - ph) / 2;
  const sh = ph / 5;
  const apexX = px + pw * 0.52;
  const midY = py + ph / 2;
  // Centroid of the triangle (px,py) (px,py+ph) (apexX,midY).
  const starCx = px + (pw * 0.52) / 3;
  return (
    <>
      <rect x={px} y={py} width={pw} height={ph} fill="#ffffff" />
      <rect x={px} y={py} width={pw} height={sh} fill="#e4002b" />
      <rect x={px} y={py + 2 * sh} width={pw} height={sh} fill="#e4002b" />
      <rect x={px} y={py + 4 * sh} width={pw} height={sh} fill="#e4002b" />
      <polygon points={`${px},${py} ${px},${py + ph} ${apexX},${midY}`} fill="#003087" />
      <polygon points={starPoints(starCx, midY, ph * 0.13)} fill="#ffffff" />
      <rect x={px} y={py} width={pw} height={ph} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
    </>
  );
}

// Centered true-proportion Jamaica flag patch: green triangles top and bottom,
// black hoist and fly, gold saltire corner to corner, inside a thin gold
// frame. Never stretched to the tile aspect. The nested <svg> clips the
// saltire to the patch, so no clipPath id is needed (ids must be unique per
// document and identical between the server and client renders).
function JmArt({ w, h, pw, ph }: { w: number; h: number; pw: number; ph: number }) {
  const px = (w - pw) / 2;
  const py = (h - ph) / 2;
  return (
    <>
      <svg x={px} y={py} width={pw} height={ph} overflow="hidden">
        <rect x={0} y={0} width={pw} height={ph} fill="#1e1b18" />
        <polygon points={`0,0 ${pw},0 ${pw / 2},${ph / 2}`} fill="#009b3a" />
        <polygon points={`0,${ph} ${pw},${ph} ${pw / 2},${ph / 2}`} fill="#009b3a" />
        <line x1={0} y1={0} x2={pw} y2={ph} stroke="#fed100" strokeWidth={ph * 0.17} />
        <line x1={pw} y1={0} x2={0} y2={ph} stroke="#fed100" strokeWidth={ph * 0.17} />
      </svg>
      <rect x={px} y={py} width={pw} height={ph} fill="none" stroke="#fed100" strokeWidth={1} />
    </>
  );
}

export default function TileBack({ skin, small = false, w, h }: Props) {
  const explicitSize = w !== undefined && h !== undefined;

  if (skin === "clasico") {
    const sizeClasses = explicitSize ? "" : small ? "w-9 h-[72px]" : "w-11 h-[88px]";
    // An explicit size scales the small preset's inner panel (20x48 on a
    // 36x72 tile), so a tile below the presets keeps it inside the border.
    const panelClasses = explicitSize ? "" : small ? "w-5 h-12" : "w-7 h-16";
    const panelStyle = explicitSize
      ? { width: Math.round((w * 5) / 9), height: Math.round((h * 2) / 3) }
      : undefined;
    return (
      <div
        style={explicitSize ? { width: w, height: h } : undefined}
        className={`
          ${sizeClasses} rounded-lg
          bg-gradient-to-br from-[#1e3a5f] via-[#1a3355] to-[#152a4a]
          border-2 border-[#0f1f35]
          flex items-center justify-center shadow-md
        `}
      >
        <div
          style={panelStyle}
          className={`
            ${panelClasses}
            rounded-md border border-[#2a5a8c]/30
            bg-gradient-to-br from-[#2a5a8c]/20 to-transparent
          `}
        />
      </div>
    );
  }

  // Today's presets: small tiles are 36x72, large 44x88.
  const width = explicitSize ? w : small ? 36 : 44;
  const height = explicitSize ? h : small ? 72 : 88;
  // Content box inside the 2px border; the rounded overflow clip gives the
  // art the app's 6px inner corners.
  const iw = width - 4;
  const ih = height - 4;
  // Flag patches are sized against the TILE dimensions (71% x 23%), never
  // stretched to the tile aspect.
  const pw = width * 0.71;
  const ph = height * 0.23;
  const { bg, border } = PREMIUM_BACKS[skin];

  // A full row squeezes its tiles like clasico ones: the art keeps its size
  // and stays centered, cropped at the sides, never stretched.
  return (
    <div
      style={{ width, height, backgroundColor: bg, borderColor: border }}
      className="rounded-lg border-2 overflow-hidden flex items-center justify-center shadow-md"
    >
      <svg width={iw} height={ih} viewBox={`0 0 ${iw} ${ih}`} aria-hidden="true" focusable="false">
        {skin === "quisqueya" ? (
          <RdArt w={iw} h={ih} />
        ) : skin === "borinquen" ? (
          <PrArt w={iw} h={ih} pw={pw} ph={ph} />
        ) : (
          <JmArt w={iw} h={ih} pw={pw} ph={ph} />
        )}
      </svg>
    </div>
  );
}
