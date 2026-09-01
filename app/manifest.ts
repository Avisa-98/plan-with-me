import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Plan With Me",
    short_name: "Plan With Me",
    description: "Capture the thought. Plan the week. No login.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f0e8",
    theme_color: "#282722",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
