import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Capi — Dominican Dominoes online";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(180deg, #f5f0e8 0%, #f0ebe3 45%, #e8d5c0 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 20,
            marginBottom: 56,
          }}
        >
          <Tile top={6} bottom={6} />
          <Tile top={5} bottom={3} />
          <Tile top={3} bottom={0} />
        </div>

        <div
          style={{
            fontSize: 240,
            fontWeight: 900,
            color: "#0a0a0a",
            letterSpacing: "-0.05em",
            lineHeight: 1,
            marginBottom: 32,
          }}
        >
          Capi
        </div>

        <div
          style={{
            fontSize: 40,
            color: "#4a4a4a",
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          Dominican Dominoes, con tu frente.
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 36,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 22,
            color: "#888",
            fontWeight: 700,
            letterSpacing: "0.12em",
          }}
        >
          PLAYCAPI.COM
        </div>
      </div>
    ),
    { ...size }
  );
}

function Tile({ top, bottom }: { top: number; bottom: number }) {
  return (
    <div
      style={{
        width: 84,
        height: 168,
        background: "#fafaf7",
        border: "3px solid #0a0a0a",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      }}
    >
      <Half count={top} />
      <div style={{ height: 3, background: "#0a0a0a", display: "flex" }} />
      <Half count={bottom} />
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
        position: "relative",
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
        width: 60,
        height: 60,
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
            width: 12,
            height: 12,
            borderRadius: 12,
            background: "#0a0a0a",
            display: "flex",
          }}
        />
      ))}
    </div>
  );
}

function pipPositions(count: number): { x: number; y: number }[] {
  const C = 24;
  const A = 4;
  const B = 44;
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
