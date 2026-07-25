import { ImageResponse } from "next/og";
import { CapiMark } from "./icon-mark";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home-screen icon for "Add to Home Screen" — same mark as the App Store
// build, so a web shortcut and the installed app look identical.
export default async function AppleIcon() {
  return new ImageResponse(<CapiMark s={180} ring />, { ...size });
}
