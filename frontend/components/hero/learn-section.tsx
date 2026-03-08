"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/layout/container";
import { useAuth } from "@/hooks/use-auth";
import { Search } from "lucide-react";

export function LearnSection() {
  const { user, openAuthModal } = useAuth();
  const [learnQuery, setLearnQuery] = useState("");
  const router = useRouter();

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
    <section className="border-t border-border/30 py-10">
      <Container className="flex flex-col items-center text-center">
        <div className="w-full max-w-md">
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Or learn about mushrooms
          </p>
          <form onSubmit={handleLearnSearch} className="relative">
            <label htmlFor="learn-search" className="sr-only">
              Search mushroom topics
            </label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              id="learn-search"
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
