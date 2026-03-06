import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import { AuthProvider } from "@/hooks/use-auth";
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
    default: "Orangutany | AI Mushroom Identifier",
    template: "%s | Orangutany",
  },
  description:
    "Take the guesswork out of mushroom identification. Orangutany uses AI trained on millions of mushroom images to instantly ID species, show global distribution maps, and tell you when to expect them. Think global, forage local.",
  keywords: [
    "mushroom identifier",
    "mushroom identification app",
    "identify mushrooms from photo",
    "AI mushroom ID",
    "foraging app",
    "wild mushroom identifier",
    "Orangutany",
    "mushroom scanner",
    "is this mushroom edible",
  ],
  metadataBase: new URL("https://orangutany.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Orangutany | AI Mushroom Identifier",
    description:
      "Take the guesswork out of mushroom ID. AI trained on millions of images — species matches, distribution maps, and seasonality. Think global, forage local.",
    url: "https://orangutany.com",
    siteName: "Orangutany",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/images/appicon.png",
        width: 512,
        height: 512,
        alt: "Orangutany — AI Mushroom Identifier",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Orangutany | AI Mushroom Identifier",
    description:
      "Take the guesswork out of mushroom ID. AI trained on millions of images — distribution maps and seasonality included.",
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
                  url: "https://orangutany.com",
                  logo: {
                    "@type": "ImageObject",
                    url: "https://orangutany.com/images/appicon.png",
                    width: 512,
                    height: 512,
                  },
                  description:
                    "AI-powered mushroom identification — trained on millions of images. Species matches, global distribution maps, seasonality, and educational resources. Think global, forage local.",
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
                  publisher: {
                    "@id": "https://orangutany.com/#organization",
                  },
                  description:
                    "Take the guesswork out of mushroom identification. AI trained on millions of images — species matches, distribution maps, seasonality, and free educational guides.",
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
          <Header />
          <main>{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
