"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Search } from "lucide-react";
import { articlesSearchable, type ArticleMeta } from "@/lib/learn-articles";
import { searchArticles, highlightTerms, type SearchResult } from "@/lib/learn-search";

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

const matchSourceLabels: Record<string, string> = {
  title: "Title match",
  summary: "In summary",
  category: "Category match",
  heading: "In section",
  body: "In article",
  synonym: "Related term",
};

const START_HERE = ["foraging-safety", "what-is-a-mushroom", "deadly-mushrooms"];

export function LearnContent({ articles }: { articles: Article[] }) {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (search.trim()) {
      url.searchParams.set("q", search.trim());
    } else {
      url.searchParams.delete("q");
    }
    window.history.replaceState({}, "", url.toString());
  }, [search]);

  const q = search.trim();

  // Full-text search with synonyms when query exists
  const searchResults = useMemo(() => {
    if (!q) return null;
    return searchArticles(articlesSearchable, q);
  }, [q]);

  // Category filter on search results or all articles
  const filtered = useMemo(() => {
    if (searchResults) {
      if (category === "All") return searchResults;
      return searchResults.filter((r) => r.category === category);
    }
    if (category === "All") return articles;
    return articles.filter((a) => a.category === category);
  }, [searchResults, category, articles]);

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
            placeholder="Search topics... try &quot;deadly&quot;, &quot;edible&quot;, &quot;spore print&quot;..."
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

        {/* Search result count + synonym hint */}
        {q && searchResults && (
          <div className="mt-6 flex items-baseline gap-2">
            <p className="text-sm text-muted-foreground">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &ldquo;{q}&rdquo;
              {searchResults.some((r) => r.matchSource === "synonym") && (
                <span className="ml-1 text-xs text-primary/70">
                  (including related terms)
                </span>
              )}
            </p>
          </div>
        )}

        {/* Deep search CTA */}
        {q && (
          <div className="mt-3 text-sm text-muted-foreground">
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
          {(filtered as (Article | SearchResult)[]).map((item) => {
            const isSearchResult = "matchSource" in item;
            const result = isSearchResult ? (item as SearchResult) : null;

            return (
              <Link
                key={item.slug}
                href={`/learn/${item.slug}`}
                className="group rounded-xl border border-border/50 bg-card p-5 transition-colors hover:border-primary/30 hover:bg-muted/20"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${categoryColors[item.category] || "bg-muted text-muted-foreground"}`}
                  >
                    {item.category}
                  </span>
                  {result && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary/80">
                      {matchSourceLabels[result.matchSource] || "Match"}
                    </span>
                  )}
                </div>
                <h2 className="mt-2.5 text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                  {q ? (
                    <HighlightedText text={item.title} query={q} />
                  ) : (
                    item.title
                  )}
                </h2>
                <p className="mt-1.5 text-sm text-foreground/60 leading-relaxed line-clamp-2">
                  {q ? (
                    <HighlightedText text={item.summary} query={q} />
                  ) : (
                    item.summary
                  )}
                </p>

                {/* Context snippet — shows WHERE the match was found */}
                {result?.snippet && (
                  <div className="mt-2.5 rounded-md bg-muted/30 px-3 py-2 text-xs leading-relaxed text-foreground/50">
                    <span className="font-medium text-foreground/70">
                      {result.matchSource === "heading" ? "" : "..."}
                    </span>
                    <HighlightedText text={result.snippet} query={q} />
                    {result.matchSource !== "heading" && (
                      <span className="font-medium text-foreground/70">...</span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
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

/** Renders text with matching terms highlighted */
function HighlightedText({ text, query }: { text: string; query: string }) {
  const segments = highlightTerms(text, query);
  return (
    <>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark key={i} className="bg-primary/20 text-foreground rounded-sm px-0.5">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}
