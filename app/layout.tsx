import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import InstallPrompt from "@/components/InstallPrompt";
import SplashScreen from "@/components/SplashScreen";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin", "greek"],
});

export const metadata: Metadata = {
  title: "Zoubou | Barber",
  description: "Κλείστε ραντεβού online στο κουρείο Zoubou.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        url: "/icons/icon-dark.png",
        sizes: "192x192",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    // Transparent background: from iOS 18 the home screen then draws the
    // dark or light icon by itself to match the phone's appearance (the
    // way Plastigia's icon does). The older white/dark pair is kept in
    // /icons as apple-touch-icon.png and apple-touch-icon-dark.png.
    apple: [{ url: "/icons/apple-touch-icon-auto.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Capped rather than locked to 1 — a hard maximumScale:1 blocks
  // pinch-to-zoom entirely, which is an accessibility problem for anyone
  // who needs to magnify text (WCAG 1.4.4).
  maximumScale: 5,
  themeColor: "#6d28d9",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="el" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col text-neutral-900">
        <div className="app-background fixed inset-0 -z-10" aria-hidden="true" />
        <SplashScreen />
        <RegisterServiceWorker />
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
