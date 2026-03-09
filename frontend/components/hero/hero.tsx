"use client";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { ArrowDown } from "lucide-react";
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
        <Button
          size="lg"
          onClick={scrollToUpload}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Scan Mushroom
          <ArrowDown className="ml-2 h-4 w-4" />
        </Button>
      </Container>
    </section>
  );
}
