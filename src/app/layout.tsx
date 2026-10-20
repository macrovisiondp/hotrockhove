import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { getSetting } from "@/lib/settings";
import { env } from "@/lib/env";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const [seo, brand] = await Promise.all([getSetting("seo"), getSetting("brand")]);
  return {
    metadataBase: new URL(env().APP_URL),
    title: { default: seo.siteTitle, template: seo.titleTemplate },
    description: seo.defaultDescription || undefined,
    icons: { icon: brand.faviconUrl, apple: "/brand/apple-icon.png" },
    // Until an admin switches indexing on at launch, nothing is indexable.
    robots: seo.allowIndexing ? undefined : { index: false, follow: false },
  };
}

export const viewport: Viewport = { themeColor: "#0b0a09", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${cormorant.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
