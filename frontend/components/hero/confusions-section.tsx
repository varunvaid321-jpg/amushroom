"use client";

import { Container } from "@/components/layout/container";
import { AlertTriangle } from "lucide-react";

const confusions = [
  { safe: "Chanterelle", dangerous: "Jack-O-Lantern", danger: "toxic" },
  { safe: "Morel", dangerous: "False Morel", danger: "toxic" },
  { safe: "Puffball", dangerous: "Death Cap (egg stage)", danger: "deadly" },
  { safe: "Honey Mushroom", dangerous: "Galerina marginata", danger: "deadly" },
];

export function ConfusionsSection() {
  return (
    <section className="border-t border-border/30 py-12">
      <Container>
        <h2 className="mb-2 text-center font-[family-name:var(--font-heading)] text-xl font-semibold text-foreground sm:text-2xl">
          Common Mushroom Confusions
        </h2>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          These mistakes happen every season. Our scanner flags them automatically.
        </p>
        <div className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
          {confusions.map((c) => (
            <div
              key={c.safe}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3"
            >
              <AlertTriangle className={`h-5 w-5 shrink-0 ${c.danger === "deadly" ? "text-red-400" : "text-amber-400"}`} />
              <div className="text-sm">
                <span className="font-medium text-foreground">{c.safe}</span>
                <span className="text-muted-foreground"> → often confused with </span>
                <span className={`font-medium ${c.danger === "deadly" ? "text-red-400" : "text-amber-400"}`}>
                  {c.dangerous}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
