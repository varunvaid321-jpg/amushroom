import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import { AuthProvider } from "@/hooks/use-auth";
import { UpgradeProvider } from "@/hooks/use-upgrade";
import { UpgradeModal } from "@/components/upgrade/upgrade-modal";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: {
    default: "Orangutany — Mushroom Identification for People Who Love Mushrooms",
    template: "%s | Orangutany",
  },
  description:
    "We love mushrooms as much as you do. Orangutany helps you identify wild species from photos — with edibility info, look-alike warnings, distribution maps, and real foraging knowledge. Engineered in Canada with world-class precision.",
  keywords: [
    "mushroom identifier",
    "mushroom identification app",
    "identify mushrooms from photo",
    "foraging app",
    "wild mushroom identifier",
    "Orangutany",
    "orangutany mushroom",
    "orangutany mushroom ID",
    "orangutany mushroom identifier",
    "orangutany mushroom app",
    "orangutany mushroom scanner",
    "orangutany foraging",
    "orangutany mushroom guide",
    "mushroom scanner",
    "is this mushroom edible",
  ],
  metadataBase: new URL("https://orangutany.com"),
  alternates: {},
  openGraph: {
    title: "Orangutany — Mushroom Identification for People Who Love Mushrooms",
    description:
      "We love mushrooms as much as you do. Identify wild species from photos — edibility info, look-alike warnings, and real foraging knowledge. Engineered in Canada with world-class precision.",
    siteName: "Orangutany",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/images/appicon.png",
        width: 512,
        height: 512,
        alt: "Orangutany — Mushroom Identification",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Orangutany — Mushroom Identification for People Who Love Mushrooms",
    description:
      "We love mushrooms as much as you do. Identify species from photos with edibility info, look-alikes, and foraging knowledge. Engineered in Canada.",
    images: ["/images/appicon.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${manrope.variable} ${sora.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://orangutany.com/#organization",
                  name: "Orangutany",
                  alternateName: [
                    "Orangutany Mushroom ID",
                    "Orangutany Mushroom",
                    "Orangutany Mushroom App",
                    "Orangutany Mushroom Identifier",
                    "Orangutany Mushroom Scanner",
                    "Orangutany Foraging",
                    "Orangutany Mushroom Guide",
                    "Orangutany ID",
                  ],
                  url: "https://orangutany.com",
                  logo: {
                    "@type": "ImageObject",
                    url: "https://orangutany.com/images/appicon.png",
                    width: 512,
                    height: 512,
                  },
                  description:
                    "Mushroom identification for people who love mushrooms. Species matches, edibility info, distribution maps, look-alike warnings, and foraging guides. Precision-engineered in Canada.",
                  sameAs: [],
                  contactPoint: {
                    "@type": "ContactPoint",
                    email: "support@orangutany.com",
                    contactType: "customer support",
                  },
                },
                {
                  "@type": "WebSite",
                  "@id": "https://orangutany.com/#website",
                  url: "https://orangutany.com",
                  name: "Orangutany",
                  alternateName: [
                    "Orangutany Mushroom Identifier",
                    "Orangutany Mushroom ID",
                    "Orangutany Mushroom App",
                    "Orangutany Foraging Guide",
                  ],
                  publisher: {
                    "@id": "https://orangutany.com/#organization",
                  },
                  description:
                    "We love mushrooms as much as you do. Identify wild species from photos, learn what's edible and what's deadly, and explore foraging guides — precision-engineered in Canada.",
                  potentialAction: {
                    "@type": "SearchAction",
                    target: "https://orangutany.com/learn?q={search_term_string}",
                    "query-input": "required name=search_term_string",
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-screen font-[family-name:var(--font-manrope)] antialiased">
        <AuthProvider>
          <UpgradeProvider>
            <Header />
            <main>{children}</main>
            <Footer />
            <UpgradeModal />
          </UpgradeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
