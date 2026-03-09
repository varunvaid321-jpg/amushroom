"use client";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { ArrowDown } from "lucide-react";
import { scrollToId } from "@/lib/scroll";

export function Hero() {
  const scrollToUpload = () => scrollToId("upload");

  return (
    <section className="hero-gradient relative overflow-hidden py-16 sm:py-24">
      <Container className="flex flex-col items-center text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/50 px-4 py-1.5 text-xs font-medium text-gold">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
          100+ Species Covered
        </div>
        <h1 className="mb-4 max-w-2xl font-[family-name:var(--font-heading)] text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Identify Wild Mushrooms{" "}
          <span className="text-primary">From a Photo</span>
        </h1>
        <p className="mb-8 max-w-lg text-lg text-muted-foreground">
          Upload a photo and get instant identification with confidence scores,
          edibility info, and look-alike warnings.
        </p>
        <Button
          size="lg"
          onClick={scrollToUpload}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Start Identifying
          <ArrowDown className="ml-2 h-4 w-4" />
        </Button>
      </Container>
    </section>
  );
}
