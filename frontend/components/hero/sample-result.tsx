"use client";

import Image from "next/image";
import { Container } from "@/components/layout/container";
import { AlertTriangle, FlaskConical, Microscope, ArrowDown } from "lucide-react";

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
            Expert-validated results
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Built on a world-class identification engine trained and validated by mycologists. Designed in Canada.
          </p>
        </div>

        <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl shadow-black/20">
          {/* Name + confidence + badges */}
          <div className="flex items-start justify-between gap-4 p-6 sm:p-8">
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

          {/* Safety warning */}
          <div className="mx-6 mb-6 rounded-lg bg-red-500/10 px-4 py-3 sm:mx-8">
            <div className="flex items-center gap-2 text-sm font-medium text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Potentially dangerous if consumed.
            </div>
          </div>

          {/* Distribution map */}
          <div className="border-t border-border/30 px-6 pt-5 pb-2 sm:px-8">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Where it&apos;s found worldwide
            </h4>
            <div className="relative overflow-hidden rounded-xl bg-[#2a3a2a]" style={{ aspectRatio: "2 / 1" }}>
              <Image
                src="/images/sample-distribution-map.png"
                alt="Global distribution map of Amanita muscaria showing recorded sightings"
                fill
                className="object-contain p-4"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
            <div className="mt-2 flex items-center gap-2 pb-4">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <span className="text-xs text-muted-foreground">Recorded sightings</span>
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
