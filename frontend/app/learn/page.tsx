import { Suspense } from "react";
import type { Metadata } from "next";
import { LearnContent } from "./learn-content";
import { articlesMeta } from "@/lib/learn-articles";

export const metadata: Metadata = {
  title: "Learn About Mushrooms",
  description:
    "Educational guides on mushroom identification, anatomy, ecology, foraging safety, and the fascinating world of fungi. Free resources for beginners and experienced foragers.",
  alternates: { canonical: "/learn" },
};

const articles = articlesMeta;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Learn About Mushrooms",
  description:
    "Educational guides on mushroom identification, anatomy, ecology, foraging safety, and the fascinating world of fungi.",
  url: "https://orangutany.com/learn",
  isPartOf: { "@id": "https://orangutany.com/#website" },
  publisher: { "@id": "https://orangutany.com/#organization" },
  mainEntity: {
    "@type": "ItemList",
    itemListElement: articles.map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://orangutany.com/learn/${a.slug}`,
      name: a.title,
    })),
  },
};

export default function LearnPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense>
        <LearnContent articles={articles} />
      </Suspense>
    </>
  );
}
