"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { useAuth } from "@/hooks/use-auth";
import { ArrowDown, Search } from "lucide-react";

export function Hero() {
  const { user, openAuthModal } = useAuth();
  const [learnQuery, setLearnQuery] = useState("");
  const router = useRouter();

  const scrollToUpload = () => {
    document.getElementById("upload")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleLearnSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = learnQuery.trim();
    if (q) {
      router.push(`/learn?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/learn");
    }
  };

  return (
    <section className="hero-gradient relative overflow-hidden py-16 sm:py-24">
      <Container className="flex flex-col items-center text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/50 px-4 py-1.5 text-xs font-medium text-gold">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
          100+ Species Covered
        </div>
        <h1 className="mb-4 max-w-2xl font-[family-name:var(--font-heading)] text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Identify wild mushrooms{" "}
          <span className="text-primary">from photos</span>
        </h1>
        <p className="mb-8 max-w-lg text-lg text-muted-foreground">
          Upload a photo and get instant identification with confidence scores,
          edibility info, and look-alike warnings.
        </p>
        <Button
          size="lg"
          onClick={scrollToUpload}
          className="mb-8 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Start Identifying
          <ArrowDown className="ml-2 h-4 w-4" />
        </Button>

        {/* Learn search */}
        <div className="w-full max-w-md">
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Or learn about mushrooms
          </p>
          <form onSubmit={handleLearnSearch} className="relative">
            <label htmlFor="hero-learn-search" className="sr-only">
              Search mushroom topics
            </label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              id="hero-learn-search"
              type="text"
              value={learnQuery}
              onChange={(e) => setLearnQuery(e.target.value)}
              placeholder="e.g. deadly mushrooms, foraging safety, anatomy..."
              className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </form>
          <div className="mt-2 flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <a
              href={`https://guide.orangutany.com/mushrooms${user ? `?user=${encodeURIComponent(user.name || user.email)}` : ""}`}
              className="text-primary/80 hover:text-primary transition"
            >
              Browse all species →
            </a>
          </div>
        </div>

        {!user && (
          <div className="mt-6 rounded-xl border border-border/50 bg-card-surface p-4 text-sm text-muted-foreground">
            <button onClick={() => openAuthModal("register")} className="font-semibold text-primary hover:underline">
              Create a free account
            </button>{" "}
            to save identifications to your personal library.
          </div>
        )}
      </Container>
    </section>
  );
}
