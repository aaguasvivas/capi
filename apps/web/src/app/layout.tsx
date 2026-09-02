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
  openGraph: {
    type: "website",
    siteName: "Capi",
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "es_DO",
    alternateLocale: ["en_US"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    title: "Capi",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f0e8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
