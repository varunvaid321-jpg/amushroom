"use client";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { ArrowDown, CheckCircle2 } from "lucide-react";
import { scrollToId } from "@/lib/scroll";

export function Hero() {
  const scrollToUpload = () => scrollToId("upload");

  return (
    <section className="hero-gradient relative overflow-hidden py-14 sm:py-20">
      <Container className="flex flex-col items-center text-center">
        <h1 className="mb-4 max-w-2xl font-[family-name:var(--font-heading)] text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Identify Wild Mushrooms{" "}
          <span className="text-primary">From a Photo</span>
        </h1>
        <p className="mb-6 max-w-lg text-lg text-muted-foreground">
          Scan a mushroom and get possible matches, confidence scores, and
          dangerous look-alikes in seconds.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            onClick={scrollToUpload}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Scan Mushroom
            <ArrowDown className="ml-2 h-4 w-4" />
          </Button>
          <a
            href="https://guide.orangutany.com/mushrooms"
            className="rounded-lg border border-border/50 px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border transition"
          >
            Browse Mushroom Guide
          </a>
        </div>

        {/* Trust strip */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Compare similar species
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Edibility &amp; toxicity info
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Confidence score per match
          </span>
        </div>
      </Container>
    </section>
  );
}
