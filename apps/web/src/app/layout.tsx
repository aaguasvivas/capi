import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/context";

const inter = Inter({ subsets: ["latin"] });

const SITE_URL = "https://playcapi.com";
const TITLE = "Capi · Dominican Dominoes";
// Metadata is static, so it carries one language: Spanish, the default UI
// language and the lang the document ships with.
const DESCRIPTION =
  "Dominó dominicano online. 1v1 o 2v2, con tu frente. Reglas auténticas, sin cuenta, comparte un enlace para invitar.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Capi",
  },
  description: DESCRIPTION,
  applicationName: "Capi",
  keywords: [
    "dominoes",
    "dominican dominoes",
    "domino dominicano",
    "capicúa",
    "online dominoes",
    "2v2 dominoes",
    "con tu frente",
    "multiplayer",
  ],
  authors: [{ name: "Capi" }],
  creator: "Capi",
  // No title or description in these two: Next fills them from each page's
  // own (the default above on the home page). A page that set an openGraph
  // object of its own would replace this one whole, image included. No url
  // either: one fixed og:url would make every page share as the home page,
  // and without it a link preview uses the address it fetched.
  openGraph: {
    type: "website",
    siteName: "Capi",
    locale: "es_DO",
    alternateLocale: ["en_US"],
  },
  twitter: {
    card: "summary_large_image",
  },
  appleWebApp: {
    capable: true,
    title: "Capi",
    statusBarStyle: "default",
  },
  // Smart App Banner in Safari on iPhone (WKWebView, so the Messages drawer,
  // ignores it). Invite links open the app through universal links; the
  // banner has no app-argument (owner decision pending).
  itunes: {
    appId: "6794404340",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

// Pinch zoom stays available everywhere (low-vision players, small table
// labels). The game table stops double-tap zoom with touch-action instead.
export const viewport: Viewport = {
  themeColor: "#f5f0e8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The layout renders statically, so lang is the Spanish default here.
  // I18nProvider updates document.documentElement.lang on the client from the
  // stored choice.
  return (
    <html lang="es">
      <body className={`${inter.className} antialiased bg-gray-50`}>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
