import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";

import "./globals.css";

const display = Fredoka({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const sans = Nunito({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Content Repurposing Agent",
  description:
    "Turn one article into a LinkedIn post, an X thread, an Instagram carousel, an email, and a 30-second video script.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable}`}>{children}</body>
    </html>
  );
}
