import { ImageResponse } from "next/og";

// iOS ignores manifest icons and SVG favicons for the home screen - it only
// reads this specific convention, and only PNG. Same mark as icon.svg,
// rendered here since Apple needs its own file.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#282722",
          padding: "0 36px",
        }}
      >
        <div style={{ width: 108, height: 16, borderRadius: 8, background: "#f4f0e8", marginBottom: 14 }} />
        <div style={{ width: 108, height: 16, borderRadius: 8, background: "#c75a3a", marginBottom: 14 }} />
        <div style={{ width: 70, height: 16, borderRadius: 8, background: "#f4f0e8" }} />
      </div>
    ),
    { ...size }
  );
}
