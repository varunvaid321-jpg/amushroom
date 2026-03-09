"use client";

import { Container } from "@/components/layout/container";
import { Target, GitCompareArrows, ShieldAlert } from "lucide-react";

const cards = [
  {
    icon: Target,
    title: "Possible Match",
    desc: "Top identification with a confidence percentage so you know how certain the result is.",
  },
  {
    icon: GitCompareArrows,
    title: "Look-Alikes",
    desc: "Species commonly confused with the result — including toxic ones you need to watch for.",
  },
  {
    icon: ShieldAlert,
    title: "Safety Notes",
    desc: "Edibility, toxicity, and caution guidance for every match. No guesswork.",
  },
];

export function AfterScanSection() {
  return (
    <section className="border-t border-border/30 py-12">
      <Container>
        <h2 className="mb-2 text-center font-[family-name:var(--font-heading)] text-xl font-semibold text-foreground sm:text-2xl">
          What you see after a scan
        </h2>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          Every result gives you the context to make a safe decision.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.title}
              className="rounded-xl border border-border/50 bg-card p-5 text-center"
            >
              <c.icon className="mx-auto mb-3 h-8 w-8 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{c.title}</h3>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
