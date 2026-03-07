"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Search } from "lucide-react";

interface Article {
  slug: string;
  title: string;
  summary: string;
  category: string;
}

const CATEGORIES = ["All", "Basics", "Identification", "Ecology", "Safety", "Foraging"];

const categoryColors: Record<string, string> = {
  Basics: "bg-emerald-900/50 text-emerald-300",
  Identification: "bg-amber-900/50 text-amber-300",
  Ecology: "bg-cyan-900/50 text-cyan-300",
  Safety: "bg-red-900/50 text-red-300",
  Foraging: "bg-orange-900/50 text-orange-300",
};

const START_HERE = ["foraging-safety", "what-is-a-mushroom", "deadly-mushrooms"];

export function LearnContent({ articles }: { articles: Article[] }) {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  // Hydrate from ?q= param
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearch(q);
  }, [searchParams]);

  // Keep URL in sync with search
  useEffect(() => {
    const url = new URL(window.location.href);
    if (search.trim()) {
      url.searchParams.set("q", search.trim());
    } else {
      url.searchParams.delete("q");
    }
    window.history.replaceState({}, "", url.toString());
  }, [search]);

  const q = search.trim().toLowerCase();

  const filtered = articles.filter((a) => {
    const matchesCategory = category === "All" || a.category === category;
    const matchesSearch =
      !q ||
      a.title.toLowerCase().includes(q) ||
      a.summary.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const startHereArticles = articles.filter((a) => START_HERE.includes(a.slug));
  const showStartHere = !q && category === "All";

  return (
    <section className="py-12">
      <Container className="max-w-4xl">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-foreground">
          Learn About Mushrooms
        </h1>
        <p className="mt-3 text-base text-foreground/70">
          Free guides on identification, ecology, and foraging safety.
        </p>

        {/* Search */}
        <div className="mt-6 relative">
          <label htmlFor="learn-search" className="sr-only">
            Search topics
          </label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            id="learn-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search topics..."
            className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        {/* Category chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                category === cat
                  ? "bg-primary text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Start here */}
        {showStartHere && (
          <div className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Start here
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {startHereArticles.map((a) => (
                <Link
                  key={a.slug}
                  href={`/learn/${a.slug}`}
                  className="rounded-lg border border-primary/30 bg-primary/5 p-4 transition hover:bg-primary/10"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium ${categoryColors[a.category] || "bg-muted text-muted-foreground"}`}>
                      {a.category}
                    </span>
                    <span className="inline-block rounded-full bg-primary/15 text-primary px-2.5 py-0.5 text-[10px] font-medium">
                      Popular
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-foreground">{a.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Deep search CTA */}
        {q && (
          <div className="mt-4 text-sm text-muted-foreground">
            Looking for a specific species?{" "}
            <a
              href={`https://guide.orangutany.com/mushrooms?q=${encodeURIComponent(q)}`}
              className="text-primary hover:underline"
            >
              Search all 100+ species on the Guide →
            </a>
          </div>
        )}

        {/* Article grid */}
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {filtered.map((article) => (
            <Link
              key={article.slug}
              href={`/learn/${article.slug}`}
              className="group rounded-xl border border-border/50 bg-card p-5 transition-colors hover:border-primary/30 hover:bg-muted/20"
            >
              <span
                className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${categoryColors[article.category] || "bg-muted text-muted-foreground"}`}
              >
                {article.category}
              </span>
              <h2 className="mt-2.5 text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                {article.title}
              </h2>
              <p className="mt-1.5 text-sm text-foreground/60 leading-relaxed line-clamp-2">
                {article.summary}
              </p>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            No articles match your search.{" "}
            <a
              href={`https://guide.orangutany.com/mushrooms?q=${encodeURIComponent(q)}`}
              className="text-primary hover:underline"
            >
              Try the full species guide →
            </a>
          </p>
        )}
      </Container>
    </section>
  );
}
