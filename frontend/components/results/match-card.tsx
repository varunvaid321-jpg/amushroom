"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ShieldAlert,
  Leaf,
  ChevronDown,
  X,
  Expand,
} from "lucide-react";
import type { Match } from "@/lib/api";
import {
  chipVariant,
  confidenceColor,
} from "@/lib/format-utils";

interface MatchCardProps {
  match: Match;
  rank: number;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export function MatchCard({ match, rank, isExpanded, onToggle }: MatchCardProps) {
  const cardImage = match.guideHeroImage || match.representativeImage;
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <Card
        className={`border-border/50 bg-card cursor-pointer transition-all hover:border-primary/30 overflow-hidden ${
          isExpanded ? "ring-2 ring-primary/40 border-primary/50 shadow-lg shadow-primary/10" : ""
        }`}
        onClick={onToggle}
      >
        {/* Hero image — full bleed at top */}
        {cardImage && (
          <div
            className="relative aspect-[3/2] w-full overflow-hidden group"
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardImage}
              alt={match.commonName}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Rank + confidence overlaid on image */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
            <span className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-xs font-bold text-white backdrop-blur-sm">
              #{rank}
            </span>
            <div className="absolute top-2 right-2 text-right">
              <span className={`text-lg font-bold tabular-nums drop-shadow-md ${confidenceColor(match.score)}`}>
                {match.score}%
              </span>
              <p className="text-[10px] text-white/70 drop-shadow-sm">confident</p>
            </div>
            {/* Expand hint */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white/70 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
              <Expand className="h-3 w-3" />
              View full photo
            </div>
          </div>
        )}
        <CardContent className={`p-4 ${!cardImage ? "pt-4" : ""}`}>
          {/* Rank + confidence fallback when no image */}
          {!cardImage && (
            <div className="flex items-center justify-between mb-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                #{rank}
              </span>
              <div className="text-right">
                <span className={`text-xl font-bold tabular-nums ${confidenceColor(match.score)}`}>
                  {match.score}%
                </span>
                <p className="text-[10px] text-muted-foreground">confident</p>
              </div>
            </div>
          )}

          {/* Name */}
          <h4 className="font-semibold text-foreground text-sm leading-tight">{match.commonName}</h4>
          <p className="text-xs italic text-muted-foreground mb-2">
            {match.scientificName}
          </p>

          {/* Edibility badge */}
          <Badge variant={chipVariant(match.edible)} className="text-xs">
            {match.edible === "Edible" ? (
              <Leaf className="mr-1 h-3 w-3" />
            ) : match.edible === "Poisonous" ? (
              <ShieldAlert className="mr-1 h-3 w-3" />
            ) : null}
            {match.edible === "Unknown" ? "Edibility Unknown" : match.edible}
          </Badge>

          {/* Expand indicator + story hint */}
          <div className="mt-3 flex flex-col items-center gap-1">
            <ChevronDown className={`h-5 w-5 text-muted-foreground/50 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
            {match.story && !isExpanded && (
              <p className="text-sm text-primary/60 font-medium">
                ✦ Tap for more
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lightbox — full uncropped image */}
      {lightboxOpen && cardImage && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90"
          onClick={() => setLightboxOpen(false)}
        >
          {/* X button — always visible, safe zone at top */}
          <div className="w-full flex justify-end px-4 py-3 flex-shrink-0">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors backdrop-blur-sm"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {/* Image — fits remaining space */}
          <div className="flex-1 flex items-center justify-center px-4 pb-2 min-h-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardImage}
              alt={match.commonName}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          </div>
          {/* Caption */}
          <p className="pb-4 text-center text-sm text-white/70 flex-shrink-0">
            {match.commonName} — <span className="italic">{match.scientificName}</span>
          </p>
          {/* Tap anywhere hint */}
          <p className="pb-3 text-center text-xs text-white/40 flex-shrink-0">
            Tap anywhere to close
          </p>
        </div>
      )}
    </>
  );
}
