import { Container } from "@/components/layout/container";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "External Resources",
  description:
    "Trusted external references for mushroom identification, ecology, and foraging. Curated by the Orangutany team.",
};

const resources = [
  {
    name: "Mushrooms of Toronto — City of Toronto Biodiversity Series (PDF)",
    url: "https://www.toronto.ca/wp-content/uploads/2020/05/8ef1-City-Planning-Mushrooms-of-Toronto-Biodiversity-Series.pdf",
    description: "72-page illustrated guide to Toronto\u2019s fungi",
    category: "Field Guides",
  },
  {
    name: "MycoGuide",
    url: "https://www.mycoguide.com/",
    description: "Interactive mushroom identification key",
    category: "Identification",
  },
  {
    name: "MushroomExpert.com",
    url: "https://www.mushroomexpert.com/",
    description: "Detailed species descriptions by Michael Kuo",
    category: "Identification",
  },
  {
    name: "iNaturalist — Fungi",
    url: "https://www.inaturalist.org/taxa/47170-Fungi",
    description: "Community-powered species observations worldwide",
    category: "Community",
  },
  {
    name: "North American Mycological Association",
    url: "https://namyco.org/",
    description: "Find local mushroom clubs, forays, and events across North America",
    category: "Community",
  },
  {
    name: "Mycological Society of America",
    url: "https://msafungi.org/",
    description: "Professional society for fungal biology research and education",
    category: "Research",
  },
  {
    name: "First Nature — Fungi",
    url: "https://www.first-nature.com/fungi/",
    description: "Extensive photo gallery and descriptions of European and North American species",
    category: "Identification",
  },
  {
    name: "Cornell Mushroom Blog",
    url: "https://blog.mycology.cornell.edu/",
    description: "Research and educational posts from Cornell University\u2019s mycology department",
    category: "Research",
  },
];

const categoryColors: Record<string, string> = {
  "Field Guides": "bg-emerald-900/50 text-emerald-300",
  Identification: "bg-amber-900/50 text-amber-300",
  Community: "bg-cyan-900/50 text-cyan-300",
  Research: "bg-violet-900/50 text-violet-300",
};

export default function ResourcesPage() {
  return (
    <section className="py-16">
      <Container className="max-w-3xl">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-foreground">
          External Resources
        </h1>
        <p className="mt-4 text-lg text-foreground/70">
          Trusted references curated by our team for deeper learning. These
          are independent resources we recommend&mdash;we are not affiliated
          with any of them.
        </p>

        <div className="mt-10 space-y-4">
          {resources.map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-border/50 bg-card p-5 transition-colors hover:border-primary/30 hover:bg-muted/20"
            >
              <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${categoryColors[r.category] || "bg-muted text-muted-foreground"}`}
              >
                {r.category}
              </span>
              <h2 className="mt-2 text-base font-semibold text-primary">
                {r.name}
              </h2>
              <p className="mt-1 text-sm text-foreground/60">
                {r.description}
              </p>
            </a>
          ))}
        </div>
      </Container>
    </section>
  );
}
