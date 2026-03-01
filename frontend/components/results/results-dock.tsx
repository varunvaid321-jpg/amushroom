"use client";

import { Loader2, Microscope } from "lucide-react";
import type { Match, UploadGuidance, ConsistencyCheck } from "@/lib/api";
import { ProfilePanel } from "./profile-panel";
import { MatchCard } from "./match-card";

interface ResultsDockProps {
  state: "idle" | "loading" | "ready";
  matches: Match[];
  uploadGuidance: UploadGuidance | null;
  consistencyCheck: ConsistencyCheck | null;
  qualityNotice?: string;
}

export function ResultsDock({
  state,
  matches,
  uploadGuidance,
  consistencyCheck,
  qualityNotice,
}: ResultsDockProps) {
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

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No matches found. Try uploading clearer photos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {qualityNotice && (
        <div className="rounded-lg bg-yellow-400/10 p-3 text-sm text-yellow-200">
          {qualityNotice}
        </div>
      )}
      <ProfilePanel
        match={matches[0]}
        uploadGuidance={uploadGuidance}
        consistencyCheck={consistencyCheck}
      />
      {matches.length > 1 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Similar Matches
          </h3>
          <div className="space-y-3">
            {matches.slice(1).map((m, i) => (
              <MatchCard key={i} match={m} rank={i + 2} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
