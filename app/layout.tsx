import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plan With Me",
  description: "A calmer place for everything you are carrying."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
