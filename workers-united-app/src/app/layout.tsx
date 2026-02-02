import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
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
  openGraph: {
    title: "Workers United – Legal International Hiring & Visa Support",
    description:
      "Transparent process. Full legal work visa guidance for international workers and companies.",
    type: "website",
    url: "https://workersunited.eu",
    siteName: "Workers United",
  },
  twitter: {
    card: "summary_large_image",
    title: "Workers United – Legal International Hiring",
    description:
      "Transparent process. Full legal work visa guidance for international workers and companies.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
