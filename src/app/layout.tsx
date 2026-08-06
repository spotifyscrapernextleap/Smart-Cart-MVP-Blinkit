import type { Metadata, Viewport } from "next";

import AppBootstrap from "@/components/AppBootstrap";
import SupportingDocsPanel from "@/components/SupportingDocsPanel";

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
        {/*
          Mounted in the layout, not a page, so it opens once per full page
          load and does not re-open on client-side navigation — the layout
          persists across route changes in the App Router. (Panel spec §1, §7.)
          Rendered last so it is the final child of <body>; it portals to
          document.body regardless, but this keeps the DOM order honest.
        */}
        <SupportingDocsPanel />
      </body>
    </html>
  );
}
