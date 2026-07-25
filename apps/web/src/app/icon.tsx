import { ImageResponse } from "next/og";
import { CapiMark } from "./icon-mark";

export const runtime = "edge";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Browser-tab favicon. No gold ring at this size: at 16px it collapses into a
// muddy outline, and the tile alone still reads as Capi.
export default async function Icon() {
  return new ImageResponse(<CapiMark s={64} ring={false} />, { ...size });
}
