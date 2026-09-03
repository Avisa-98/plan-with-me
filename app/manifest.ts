import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bunko",
    short_name: "Bunko",
    description: "Capture the thought. Plan the week. No login.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3ece0",
    theme_color: "#2b2420",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
