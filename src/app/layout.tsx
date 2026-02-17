import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { GodModeWrapper } from "@/components/GodModeWrapper";
import CookieConsent from "@/components/CookieConsent";
import ToastProvider from "@/components/ToastProvider";


const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://workersunited.eu"),
  title: "Workers United – Legal International Hiring & Visa Support",
  description:
    "Workers United connects serious employers with reliable workers worldwide and guides both sides through the full work visa process – without fake promises or hidden conditions.",
  keywords: [
    "international employment",
    "work visa",
    "legal hiring",
    "EU work permits",
    "visa support",
    "employment agency Europe",
    "international recruitment",
  ],
  authors: [{ name: "Workers United" }],
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Workers United – Legal International Hiring & Visa Support",
    description:
      "Transparent process. Full legal work visa guidance for international workers and companies.",
    type: "website",
    url: "https://workersunited.eu",
    siteName: "Workers United",
    images: ["/logo-full.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Workers United – Legal International Hiring",
    description:
      "Transparent process. Full legal work visa guidance for international workers and companies.",
    images: ["/logo-full.jpg"],
  },
  manifest: "/manifest.json",
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "theme-color": "#1877f2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${montserrat.className} antialiased`}>
        {children}
        <GodModeWrapper />
        <CookieConsent />
        <ToastProvider />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
