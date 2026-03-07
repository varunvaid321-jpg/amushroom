import { Suspense } from "react";
import type { Metadata } from "next";
import { LearnContent } from "./learn-content";

export const metadata: Metadata = {
  title: "Learn About Mushrooms",
  description:
    "Educational guides on mushroom identification, anatomy, ecology, foraging safety, and the fascinating world of fungi. Free resources for beginners and experienced foragers.",
  alternates: { canonical: "/learn" },
};

const articles = [
  {
    slug: "what-is-a-mushroom",
    title: "What Is a Mushroom?",
    summary:
      "Mushrooms are the visible fruiting bodies of fungi — like an iceberg, the bulk of the organism lives hidden underground. Learn how they differ from plants, how they reproduce, and why they matter.",
    category: "Basics",
  },
  {
    slug: "types-of-mushrooms",
    title: "Types of Mushrooms",
    summary:
      "From gilled mushrooms and boletes to polypores, puffballs, morels, and coral fungi — a visual guide to the major groups you'll encounter in the wild.",
    category: "Basics",
  },
  {
    slug: "mushroom-anatomy",
    title: "Mushroom Anatomy & Identification",
    summary:
      "Cap, gills, stalk, annulus, volva — understanding the parts of a mushroom is the first step to identifying what you've found. Learn how to make a spore print.",
    category: "Identification",
  },
  {
    slug: "ecology-of-fungi",
    title: "The Ecology of Fungi",
    summary:
      "Fungi are nature's recyclers. Saprobes break down dead wood, mycorrhizal fungi feed trees, and pathogens keep ecosystems in check. Discover the hidden network beneath the forest floor.",
    category: "Ecology",
  },
  {
    slug: "mycorrhizal-networks",
    title: "Mycorrhizal Networks: The Wood Wide Web",
    summary:
      "Over 80% of plant species host fungi in their roots. These mycorrhizal partnerships allow trees to share nutrients underground — a hidden internet connecting the forest.",
    category: "Ecology",
  },
  {
    slug: "foraging-safety",
    title: "Foraging Safety: Rules Every Beginner Must Know",
    summary:
      "Never eat a wild mushroom unless you are 100% certain of its identity. Learn the golden rules of foraging, common deadly look-alikes, and what to do if someone is poisoned.",
    category: "Safety",
  },
  {
    slug: "deadly-mushrooms",
    title: "Deadly Mushrooms You Must Recognize",
    summary:
      "The Destroying Angel, Death Cap, and other lethal species look deceptively innocent. Learn to identify the mushrooms that send people to hospital every year.",
    category: "Safety",
  },
  {
    slug: "edible-mushrooms-beginners",
    title: "Best Edible Mushrooms for Beginners",
    summary:
      "Chanterelles, porcini, oyster mushrooms, and morels — these beginner-friendly species are distinctive, delicious, and relatively safe to identify with proper guidance.",
    category: "Foraging",
  },
  {
    slug: "seasonal-foraging-guide",
    title: "A Seasonal Foraging Calendar",
    summary:
      "Spring morels, summer chanterelles, autumn porcini, winter oysters — know what to look for and when. A month-by-month guide to the mushroom year.",
    category: "Foraging",
  },
];

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
