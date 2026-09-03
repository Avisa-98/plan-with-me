import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bunko",
  description: "A calmer place for everything you are carrying.",
  manifest: "/manifest.webmanifest",
  // Saved to the home screen, this makes it open full-screen with its own
  // title bar instead of inside Safari's normal browser chrome.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bunko",
  },
};

export const viewport: Viewport = {
  themeColor: "#2b2420",
};

// Runs before the page paints, so the theme is right on the very first
// frame - without this, the app would flash light for an instant even for
// someone who chose dark, every single time it loads.
const themeInit = `(function(){try{var s=localStorage.getItem("plan-with-me:theme");var t=(s==="dark"||s==="light")?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <Script id="theme-init" strategy="beforeInteractive">{themeInit}</Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
