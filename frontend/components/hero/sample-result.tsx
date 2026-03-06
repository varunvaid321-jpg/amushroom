"use client";

import { Container } from "@/components/layout/container";
import { AlertTriangle, MapPin, FlaskConical, Microscope, ArrowDown } from "lucide-react";

const TRAITS = [
  "hymenium type: lamella",
  "stipe character: ring and volva stipe",
  "spore print color: white",
  "cap shape: flat or convex",
];

const LOOK_ALIKES = ["Amanita parcivolvata", "Amanita caesarea", "Amanita regalis"];

export function SampleResult() {
  const scrollToUpload = () => {
    document.getElementById("upload")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="border-t border-border/30 bg-background py-16">
      <Container>
        <div className="mb-10 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
            See what you get
          </p>
          <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-foreground sm:text-4xl">
            Real AI-powered results
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Upload a photo and get detailed identification in seconds. Here&apos;s a real scan of the iconic Fly Agaric.
          </p>
        </div>

        <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl shadow-black/20">
          {/* Header with mushroom name + confidence */}
          <div className="flex items-start justify-between gap-4 border-b border-border/30 p-6 sm:p-8">
            <div>
              <h3 className="text-2xl font-bold text-foreground sm:text-3xl">Fly agaric</h3>
              <p className="mt-1 text-sm italic text-muted-foreground">Amanita muscaria</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-400">
                  <AlertTriangle className="h-3 w-3" /> Poisonous
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  <FlaskConical className="h-3 w-3" /> Psychoactive
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-4xl font-bold tabular-nums text-primary sm:text-5xl">98%</span>
              <p className="mt-1 text-xs text-muted-foreground">confidence</p>
            </div>
          </div>

          {/* Description */}
          <div className="border-b border-border/30 px-6 py-5 sm:px-8">
            <p className="text-sm leading-relaxed text-foreground/80">
              Fly agaric (Amanita muscaria) is one of the most recognizable mushrooms in the world, known for its bright red cap with white spots. Found in temperate forests across the Northern Hemisphere.
            </p>
          </div>

          {/* Key Traits */}
          <div className="border-b border-border/30 px-6 py-5 sm:px-8">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Key Traits
            </h4>
            <div className="flex flex-wrap gap-2">
              {TRAITS.map((t) => (
                <span key={t} className="rounded-full bg-muted/40 px-3 py-1 text-xs text-foreground/70">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Taxonomy + Look-alikes side by side */}
          <div className="grid border-b border-border/30 sm:grid-cols-2">
            <div className="border-b border-border/30 px-6 py-5 sm:border-b-0 sm:border-r sm:px-8">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Taxonomy
              </h4>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Genus</p>
                  <p className="font-medium text-foreground">Amanita</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Family</p>
                  <p className="font-medium text-foreground">Amanitaceae</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Order</p>
                  <p className="font-medium text-foreground">Agaricales</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 sm:px-8">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Look-Alikes
              </h4>
              <ul className="space-y-1.5">
                {LOOK_ALIKES.map((name) => (
                  <li key={name} className="flex items-center gap-2 text-sm text-foreground/80">
                    <AlertTriangle className="h-3 w-3 shrink-0 text-yellow-500/70" />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Distribution hint */}
          <div className="border-b border-border/30 px-6 py-5 sm:px-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary/60" />
              Found worldwide — temperate and boreal forests across North America, Europe, and Asia.
            </div>
          </div>

          {/* Safety warning */}
          <div className="bg-red-500/8 px-6 py-4 sm:px-8">
            <div className="flex items-center gap-2 text-sm font-medium text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Potentially dangerous if consumed.
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <button
            onClick={scrollToUpload}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Microscope className="h-5 w-5" />
            Try It With Your Mushroom
            <ArrowDown className="h-4 w-4" />
          </button>
          <p className="mt-3 text-xs text-muted-foreground">
            Free — no account required for your first scans.
          </p>
        </div>
      </Container>
    </section>
  );
}
