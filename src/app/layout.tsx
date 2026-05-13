import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/context";

const inter = Inter({ subsets: ["latin"] });

const SITE_URL = "https://playcapi.com";
const TITLE = "Capi — Dominican Dominoes";
const DESCRIPTION =
  "Dominican Dominoes online. Play 1v1 or 2v2 (con tu frente) — authentic rules, no account, share a link to invite.";

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
    locale: "en_US",
    alternateLocale: ["es_DO"],
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
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-gray-50`}>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
