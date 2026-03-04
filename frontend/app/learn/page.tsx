import { Container } from "@/components/layout/container";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learn About Mushrooms",
  description:
    "Educational guides on mushroom identification, anatomy, ecology, foraging safety, and the fascinating world of fungi. Free resources for beginners and experienced foragers.",
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

const categoryColors: Record<string, string> = {
  Basics: "bg-emerald-900/50 text-emerald-300",
  Identification: "bg-amber-900/50 text-amber-300",
  Ecology: "bg-cyan-900/50 text-cyan-300",
  Safety: "bg-red-900/50 text-red-300",
  Foraging: "bg-orange-900/50 text-orange-300",
};

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
    <section className="py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Container className="max-w-4xl">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-foreground">
          Learn About Mushrooms
        </h1>
        <p className="mt-4 text-lg text-foreground/70">
          Free educational guides on mushroom identification, ecology, and
          foraging safety. Whether you&rsquo;re a curious beginner or an
          experienced forager, there&rsquo;s always more to discover about the
          fascinating kingdom of fungi.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/learn/${article.slug}`}
              className="group rounded-xl border border-border/50 bg-card p-6 transition-colors hover:border-primary/30 hover:bg-muted/20"
            >
              <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${categoryColors[article.category] || "bg-muted text-muted-foreground"}`}
              >
                {article.category}
              </span>
              <h2 className="mt-3 text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                {article.title}
              </h2>
              <p className="mt-2 text-sm text-foreground/60 leading-relaxed">
                {article.summary}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-16 rounded-xl border border-border/50 bg-card p-8">
          <h2 className="text-xl font-semibold text-foreground">
            External Resources
          </h2>
          <p className="mt-2 text-sm text-foreground/60">
            Trusted references for deeper learning.
          </p>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <a
                href="https://www.toronto.ca/wp-content/uploads/2020/05/8ef1-City-Planning-Mushrooms-of-Toronto-Biodiversity-Series.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Mushrooms of Toronto — City of Toronto Biodiversity Series (PDF)
              </a>
              <span className="text-foreground/40"> — 72-page illustrated guide to Toronto&rsquo;s fungi</span>
            </li>
            <li>
              <a
                href="https://www.mycoguide.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                MycoGuide
              </a>
              <span className="text-foreground/40"> — interactive mushroom identification key</span>
            </li>
            <li>
              <a
                href="https://www.mushroomexpert.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                MushroomExpert.com
              </a>
              <span className="text-foreground/40"> — detailed species descriptions by Michael Kuo</span>
            </li>
            <li>
              <a
                href="https://www.inaturalist.org/taxa/47170-Fungi"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                iNaturalist — Fungi
              </a>
              <span className="text-foreground/40"> — community-powered species observations worldwide</span>
            </li>
          </ul>
        </div>
      </Container>
    </section>
  );
}
