import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
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
          position: "relative",
        }}
      >
        <div
          style={{
            fontSize: 128,
            fontWeight: 900,
            color: "#f5f0e8",
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: "-0.06em",
            lineHeight: 1,
            display: "flex",
            marginTop: -6,
          }}
        >
          C
        </div>
        {/* Gold pip accent */}
        <div
          style={{
            position: "absolute",
            top: 30,
            right: 36,
            width: 22,
            height: 22,
            borderRadius: 22,
            background: "#c9a961",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
