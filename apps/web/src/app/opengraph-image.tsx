import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Capi · Dominican Dominoes online";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#0a0a0a";
const INK_SOFT = "#1f1f1f";
const GOLD = "#b8860b";
const TILE_FACE = "#fafaf7";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background:
            "linear-gradient(135deg, #f7f1e6 0%, #f0e7d4 55%, #e8d2b0 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Subtle warm light from top-right */}
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -160,
            width: 700,
            height: 700,
            borderRadius: 700,
            background:
              "radial-gradient(circle at center, rgba(255,200,120,0.35), rgba(255,200,120,0) 70%)",
            display: "flex",
          }}
        />

        {/* Brand block (left) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingLeft: 90,
            paddingTop: 70,
            paddingBottom: 70,
            width: 720,
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: 248,
              fontWeight: 900,
              color: INK,
              letterSpacing: "-0.055em",
              lineHeight: 0.9,
            }}
          >
            Capi
          </div>

          {/* Gold underline accent */}
          <div
            style={{
              width: 128,
              height: 6,
              background: GOLD,
              marginTop: 18,
              marginBottom: 26,
              display: "flex",
            }}
          />

          <div
            style={{
              fontSize: 24,
              color: "#6c6c6c",
              fontWeight: 700,
              letterSpacing: "0.22em",
              marginBottom: 28,
            }}
          >
            DOMINÓ DOMINICANO
          </div>

          <div
            style={{
              fontSize: 54,
              color: INK_SOFT,
              fontWeight: 600,
              fontStyle: "italic",
              letterSpacing: "-0.015em",
              lineHeight: 1.05,
            }}
          >
            Como en el patio.
          </div>

          <div
            style={{
              fontSize: 28,
              color: "#7a7a7a",
              fontWeight: 500,
              marginTop: 14,
              letterSpacing: "-0.005em",
            }}
          >
            1v1 o 2v2. Sin cuenta. Sin estrés.
          </div>
        </div>

        {/* Scattered tiles (right), feels like a game in progress */}
        <Tile pipsA={6} pipsB={6} left={770} top={70} rotate={-7} />
        <Tile pipsA={3} pipsB={6} left={975} top={235} rotate={13} />
        <Tile pipsA={3} pipsB={0} left={815} top={395} rotate={-15} />

        {/* Footer stamp */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            right: 44,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 20,
            color: GOLD,
            fontWeight: 700,
            letterSpacing: "0.22em",
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 28,
              height: 2,
              background: GOLD,
              display: "flex",
            }}
          />
          PLAYCAPI.COM
        </div>
      </div>
    ),
    { ...size }
  );
}

function Tile({
  pipsA,
  pipsB,
  left,
  top,
  rotate,
}: {
  pipsA: number;
  pipsB: number;
  left: number;
  top: number;
  rotate: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: 132,
        height: 264,
        background: TILE_FACE,
        border: "3px solid #0a0a0a",
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        boxShadow:
          "0 18px 36px rgba(20,15,5,0.20), 0 4px 10px rgba(20,15,5,0.12)",
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <Half count={pipsA} />
      <div style={{ height: 3, background: INK, display: "flex" }} />
      <Half count={pipsB} />
    </div>
  );
}

function Half({ count }: { count: number }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <PipLayout count={count} />
    </div>
  );
}

function PipLayout({ count }: { count: number }) {
  const positions = pipPositions(count);
  return (
    <div
      style={{
        position: "relative",
        width: 88,
        height: 88,
        display: "flex",
      }}
    >
      {positions.map((pos, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: pos.x,
            top: pos.y,
            width: 18,
            height: 18,
            borderRadius: 18,
            background: INK,
            display: "flex",
          }}
        />
      ))}
    </div>
  );
}

function pipPositions(count: number): { x: number; y: number }[] {
  const C = 35;
  const A = 8;
  const B = 62;
  switch (count) {
    case 0:
      return [];
    case 1:
      return [{ x: C, y: C }];
    case 2:
      return [
        { x: A, y: A },
        { x: B, y: B },
      ];
    case 3:
      return [
        { x: A, y: A },
        { x: C, y: C },
        { x: B, y: B },
      ];
    case 4:
      return [
        { x: A, y: A },
        { x: B, y: A },
        { x: A, y: B },
        { x: B, y: B },
      ];
    case 5:
      return [
        { x: A, y: A },
        { x: B, y: A },
        { x: C, y: C },
        { x: A, y: B },
        { x: B, y: B },
      ];
    case 6:
      return [
        { x: A, y: A },
        { x: B, y: A },
        { x: A, y: C },
        { x: B, y: C },
        { x: A, y: B },
        { x: B, y: B },
      ];
    default:
      return [];
  }
}
