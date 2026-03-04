"use client";

import { useState } from "react";
import { Loader2, Microscope, Lock } from "lucide-react";
import type { Match, UploadGuidance, ConsistencyCheck } from "@/lib/api";
import { ProfilePanel } from "./profile-panel";
import { MatchCard } from "./match-card";
import { AuthModal } from "@/components/auth/auth-modal";
import { Button } from "@/components/ui/button";

interface ResultsDockProps {
  state: "idle" | "loading" | "ready";
  matches: Match[];
  uploadGuidance: UploadGuidance | null;
  consistencyCheck: ConsistencyCheck | null;
  qualityNotice?: string;
  quotaExceeded?: boolean;
  quotaTier?: string;
}

export function ResultsDock({
  state,
  matches,
  uploadGuidance,
  consistencyCheck,
  qualityNotice,
  quotaExceeded,
  quotaTier,
}: ResultsDockProps) {
  const [authOpen, setAuthOpen] = useState(false);

  if (state === "idle") {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <Microscope className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Upload photos and tap Analyze to identify mushrooms.
        </p>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Analyzing your photos...
        </p>
      </div>
    );
  }

  // Filter: only show matches with >= 30% confidence
  const viableMatches = matches.filter((m) => m.score >= 30);

  if (viableMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border py-16 text-center">
        <Microscope className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          No confident matches found. Try uploading clearer photos from multiple angles.
        </p>
      </div>
    );
  }

  // Anonymous soft wall — show teaser with blur overlay
  if (quotaExceeded && quotaTier === "anonymous") {
    const top = viableMatches[0];
    return (
      <div className="space-y-4">
        <div className="relative rounded-xl border border-border bg-card overflow-hidden">
          {/* Teaser: name + confidence */}
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{top.commonName}</h2>
                <p className="text-sm italic text-muted-foreground">{top.scientificName}</p>
              </div>
              <div className="text-3xl font-bold tabular-nums text-primary">
                {top.score}%
              </div>
            </div>
            {/* Blurred placeholder for details */}
            <div className="select-none pointer-events-none" style={{ filter: "blur(8px)" }} aria-hidden="true">
              <div className="space-y-3">
                <div className="h-4 w-3/4 rounded bg-muted/50" />
                <div className="h-4 w-1/2 rounded bg-muted/50" />
                <div className="flex gap-2">
                  <div className="h-6 w-16 rounded-full bg-muted/50" />
                  <div className="h-6 w-20 rounded-full bg-muted/50" />
                </div>
                <div className="h-20 w-full rounded bg-muted/50" />
                <div className="h-4 w-2/3 rounded bg-muted/50" />
                <div className="h-4 w-1/2 rounded bg-muted/50" />
              </div>
            </div>
          </div>
          {/* CTA overlay */}
          <div className="border-t border-border bg-card/95 p-6 text-center">
            <Lock className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
            <p className="mb-1 text-base font-semibold text-foreground">
              Full results are locked
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              Create a free account to unlock edibility info, traits, look-alikes, and get 5 IDs per day.
            </p>
            <Button onClick={() => setAuthOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Create Free Account
            </Button>
          </div>
        </div>
        <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultTab="register" />
      </div>
    );
  }

  const secondaryMatches = viableMatches.slice(1);

  return (
    <div className="space-y-4">
      {qualityNotice && (
        <div className="rounded-lg bg-yellow-400/10 p-3 text-sm text-yellow-200">
          {qualityNotice}
        </div>
      )}
      <ProfilePanel
        match={viableMatches[0]}
        uploadGuidance={uploadGuidance}
        consistencyCheck={consistencyCheck}
      />
      {secondaryMatches.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Similar Matches
          </h3>
          <div className="space-y-3">
            {secondaryMatches.map((m, i) => (
              <MatchCard key={i} match={m} rank={i + 2} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
