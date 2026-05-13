import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          borderRadius: 14,
          position: "relative",
        }}
      >
        <div
          style={{
            fontSize: 46,
            fontWeight: 900,
            color: "#f5f0e8",
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: "-0.06em",
            lineHeight: 1,
            display: "flex",
            marginTop: -2,
          }}
        >
          C
        </div>
        {/* Gold pip accent */}
        <div
          style={{
            position: "absolute",
            top: 11,
            right: 13,
            width: 8,
            height: 8,
            borderRadius: 8,
            background: "#c9a961",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
