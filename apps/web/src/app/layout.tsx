import type { Metadata, Viewport } from "next";
import "./globals.css";
import InstallBanner from "./install-banner";

export const metadata: Metadata = {
  title: "DeepFuse",
  description: "Create playlists that match everyone's taste",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DeepFuse",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#4A3AFF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-white text-gray-900 antialiased">
        <main className="mx-auto min-h-dvh max-w-md">{children}</main>
        <InstallBanner />
      </body>
    </html>
  );
}
