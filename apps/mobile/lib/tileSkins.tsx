import {
  createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  Polygon,
  Rect,
} from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type TileSkinId = "clasico" | "quisqueya" | "borinquen" | "kingston";
const STORAGE_KEY = "@capi/tile_skin";

export interface TileSkin {
  id: TileSkinId;
  face: string;
  faceDouble: string;
  border: string;
  borderDouble: string;
  pipTop: [string, string, string];    // radial gradient stops, light→dark
  pipBottom: [string, string, string];
  divider: string;
  dividerDouble: string;
  spinner: string | null;              // center dot on the divider
  back: {
    bg: string;
    border: string;
    variant: "clasico" | "rd" | "pr" | "jm";
  };
}

const DRILLED: [string, string, string] = ["#3a3a3a", "#1c1c1c", "#050505"];

export const TILE_SKINS: Record<TileSkinId, TileSkin> = {
  clasico: {
    id: "clasico",
    face: "#FBF8ED", faceDouble: "#ECE4CC",
    border: "#c8bc9e", borderDouble: "#8a7d60",
    pipTop: DRILLED, pipBottom: DRILLED,
    divider: "#b8a882", dividerDouble: "#8a7d60",
    spinner: null,
    back: { bg: "#1e3a5f", border: "#0f1f35", variant: "clasico" },
  },
  quisqueya: {
    id: "quisqueya",
    face: "#f8f4ea", faceDouble: "#efe7d2",
    border: "#c9b98e", borderDouble: "#8a7d60",
    pipTop: ["#e05252", "#b71c1c", "#7f0f0f"],
    pipBottom: ["#4a6fb5", "#1d3f7a", "#0e2450"],
    divider: "#c9a227", dividerDouble: "#c9a227",
    spinner: "#c9a227",
    back: { bg: "#ffffff", border: "#8a7d60", variant: "rd" },
  },
  borinquen: {
    id: "borinquen",
    face: "#fbfbfb", faceDouble: "#f0f0f0",
    border: "#c4c4c4", borderDouble: "#8f8f8f",
    pipTop: ["#f26666", "#e4002b", "#8f0018"],
    pipBottom: ["#f26666", "#e4002b", "#8f0018"],
    divider: "#003087", dividerDouble: "#003087",
    spinner: "#003087",
    back: { bg: "#003087", border: "#001d52", variant: "pr" },
  },
  kingston: {
    id: "kingston",
    face: "#1f1f1f", faceDouble: "#151515",
    border: "#000000", borderDouble: "#3a3a3a",
    pipTop: ["#ffe066", "#fed100", "#9c7f00"],
    pipBottom: ["#ffe066", "#fed100", "#9c7f00"],
    divider: "#009b3a", dividerDouble: "#009b3a",
    spinner: "#fed100",
    back: { bg: "#141414", border: "#000000", variant: "jm" },
  },
};

export function asTileSkinId(v: unknown): TileSkinId | null {
  return v === "clasico" || v === "quisqueya" || v === "borinquen" || v === "kingston"
    ? v
    : null;
}

interface SkinCtx {
  skin: TileSkin;
  skinId: TileSkinId;
  setSkinId: (id: TileSkinId) => void;
}

const SkinContext = createContext<SkinCtx>({
  skin: TILE_SKINS.clasico,
  skinId: "clasico",
  setSkinId: () => {},
});

export function SkinProvider({ children }: { children: ReactNode }) {
  const [skinId, setSkinIdRaw] = useState<TileSkinId>("clasico");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      const id = asTileSkinId(stored);
      if (id) setSkinIdRaw(id);
    });
  }, []);

  const value = useMemo<SkinCtx>(
    () => ({
      skin: TILE_SKINS[skinId],
      skinId,
      setSkinId: (id: TileSkinId) => {
        setSkinIdRaw(id);
        AsyncStorage.setItem(STORAGE_KEY, id);
      },
    }),
    [skinId],
  );

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}

export function useTileSkin() {
  return useContext(SkinContext);
}

// ---------------------------------------------------------------------------
// Back renderer
// ---------------------------------------------------------------------------

// Unique ids so multiple tile backs' ClipPath defs never collide.
let backClipSeq = 0;

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
      <Rect x={0} y={0} width={qw} height={qh} fill="#002d62" />
      <Rect x={w - qw} y={0} width={qw} height={qh} fill="#ce1126" />
      <Rect x={0} y={h - qh} width={qw} height={qh} fill="#ce1126" />
      <Rect x={w - qw} y={h - qh} width={qw} height={qh} fill="#002d62" />
      <Circle cx={w / 2} cy={h / 2} r={w * 0.08} fill="#c9a227" />
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
      <Rect x={px} y={py} width={pw} height={ph} fill="#ffffff" />
      <Rect x={px} y={py} width={pw} height={sh} fill="#e4002b" />
      <Rect x={px} y={py + 2 * sh} width={pw} height={sh} fill="#e4002b" />
      <Rect x={px} y={py + 4 * sh} width={pw} height={sh} fill="#e4002b" />
      <Polygon
        points={`${px},${py} ${px},${py + ph} ${apexX},${midY}`}
        fill="#003087"
      />
      <Polygon points={starPoints(starCx, midY, ph * 0.13)} fill="#ffffff" />
      <Rect
        x={px}
        y={py}
        width={pw}
        height={ph}
        fill="none"
        stroke="rgba(0,0,0,0.25)"
        strokeWidth={1}
      />
    </>
  );
}

// Centered true-proportion Jamaica flag patch: green triangles top and bottom,
// black hoist and fly, gold saltire corner to corner, inside a thin gold
// frame. Never stretched to the tile aspect.
function JmArt({ w, h, pw, ph }: { w: number; h: number; pw: number; ph: number }) {
  const clipId = useRef(`tileback-jm-${backClipSeq++}`).current;
  const px = (w - pw) / 2;
  const py = (h - ph) / 2;
  const cx = px + pw / 2;
  const cy = py + ph / 2;
  return (
    <>
      <Defs>
        <ClipPath id={clipId}>
          <Rect x={px} y={py} width={pw} height={ph} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Rect x={px} y={py} width={pw} height={ph} fill="#1e1b18" />
        <Polygon points={`${px},${py} ${px + pw},${py} ${cx},${cy}`} fill="#009b3a" />
        <Polygon
          points={`${px},${py + ph} ${px + pw},${py + ph} ${cx},${cy}`}
          fill="#009b3a"
        />
        <Line
          x1={px}
          y1={py}
          x2={px + pw}
          y2={py + ph}
          stroke="#fed100"
          strokeWidth={ph * 0.17}
        />
        <Line
          x1={px + pw}
          y1={py}
          x2={px}
          y2={py + ph}
          stroke="#fed100"
          strokeWidth={ph * 0.17}
        />
      </G>
      <Rect
        x={px}
        y={py}
        width={pw}
        height={ph}
        fill="none"
        stroke="#fed100"
        strokeWidth={1}
      />
    </>
  );
}

export function TileBack({
  skin,
  width,
  height,
}: {
  skin: TileSkin;
  width: number;
  height: number;
}) {
  const { bg, border, variant } = skin.back;
  // Today's presets: small tiles are 36x72, large 44x88.
  const small = width < 40;
  // Content box inside the 2px border.
  const iw = width - 4;
  const ih = height - 4;
  // Flag patches are sized against the TILE dimensions (71% x 23%), never
  // stretched to the tile aspect.
  const pw = width * 0.71;
  const ph = height * 0.23;

  return (
    <View
      style={{
        width,
        height,
        borderRadius: 8,
        backgroundColor: bg,
        borderWidth: 2,
        borderColor: border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {variant === "clasico" ? (
        <View
          style={{
            width: small ? 20 : 28,
            height: small ? 48 : 64,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: "rgba(42,90,140,0.3)",
            backgroundColor: "rgba(42,90,140,0.2)",
          }}
        />
      ) : (
        <View style={{ width: iw, height: ih, borderRadius: 6, overflow: "hidden" }}>
          <Svg width={iw} height={ih}>
            {variant === "rd" ? (
              <RdArt w={iw} h={ih} />
            ) : variant === "pr" ? (
              <PrArt w={iw} h={ih} pw={pw} ph={ph} />
            ) : (
              <JmArt w={iw} h={ih} pw={pw} ph={ph} />
            )}
          </Svg>
        </View>
      )}
    </View>
  );
}
