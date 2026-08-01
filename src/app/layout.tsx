import type { Metadata, Viewport } from "next";

import AppBootstrap from "@/components/AppBootstrap";

import "./globals.css";

export const metadata: Metadata = {
  title: "Blinkit — Smart Cart",
  description: "Groceries in 23 minutes",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The panel sits above the bill; a pinch-zoom mid-checkout should not be
  // disabled, so maximumScale is deliberately left alone.
  themeColor: "#f8cb46",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <AppBootstrap />
        <div className="app-shell flex min-h-full flex-col">{children}</div>
      </body>
    </html>
  );
}
