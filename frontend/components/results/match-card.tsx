"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
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
            {/* Overlays on image */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <span className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white backdrop-blur-sm">
              #{rank}
            </span>
            {/* Confidence pill — solid bg, always readable */}
            <div className={`absolute top-2 right-2 rounded-full px-2.5 py-1 backdrop-blur-sm ${
              match.score >= 80 ? "bg-green-600/90" : match.score >= 50 ? "bg-yellow-600/90" : "bg-red-600/90"
            }`}>
              <span className="text-sm font-bold tabular-nums text-white">
                {match.score}%
              </span>
            </div>
            {/* Expand hint */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white/70 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
              <Expand className="h-3 w-3" />
              View full photo
            </div>
          </div>
        )}
        <CardContent className={`px-3 py-3 ${!cardImage ? "pt-4" : ""}`}>
          {/* Rank + confidence fallback when no image */}
          {!cardImage && (
            <div className="flex items-center justify-between mb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                #{rank}
              </span>
              <div className={`rounded-full px-2.5 py-1 ${
                match.score >= 80 ? "bg-green-600/90" : match.score >= 50 ? "bg-yellow-600/90" : "bg-red-600/90"
              }`}>
                <span className="text-sm font-bold tabular-nums text-white">{match.score}%</span>
              </div>
            </div>
          )}

          {/* Name */}
          <h4 className="font-bold text-foreground text-base leading-tight">{match.commonName}</h4>
          <p className="text-xs italic text-muted-foreground mb-2">
            {match.scientificName}
          </p>

          {/* Edibility — large, unmissable */}
          <div className={`w-full rounded-lg py-2 px-3 flex items-center justify-center gap-2 ${
            match.edible.toLowerCase().includes("poisonous") || match.edible.toLowerCase().includes("toxic") || match.edible.toLowerCase().includes("deadly")
              ? "bg-red-600/15 border border-red-500/30"
              : match.edible.toLowerCase().includes("edible")
                ? "bg-green-600/15 border border-green-500/30"
                : "bg-muted/50 border border-border/50"
          }`}>
            {match.edible.toLowerCase().includes("edible") && !match.edible.toLowerCase().includes("not") ? (
              <Leaf className={`h-4 w-4 flex-shrink-0 ${match.edible.toLowerCase().includes("edible") ? "text-green-500" : "text-muted-foreground"}`} />
            ) : match.edible.toLowerCase().includes("poisonous") || match.edible.toLowerCase().includes("toxic") || match.edible.toLowerCase().includes("deadly") ? (
              <ShieldAlert className="h-4 w-4 flex-shrink-0 text-red-500" />
            ) : null}
            <span className={`text-sm font-bold ${
              match.edible.toLowerCase().includes("poisonous") || match.edible.toLowerCase().includes("toxic") || match.edible.toLowerCase().includes("deadly")
                ? "text-red-400"
                : match.edible.toLowerCase().includes("edible")
                  ? "text-green-400"
                  : "text-muted-foreground"
            }`}>
              {match.edible === "Unknown" ? "Edibility Unknown" : match.edible}
            </span>
          </div>

          {/* Expand indicator + story hint */}
          <div className="mt-2 flex flex-col items-center gap-0.5">
            <ChevronDown className={`h-5 w-5 text-muted-foreground/50 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
            {match.story && !isExpanded && (
              <p className="text-sm text-primary/60 font-medium">
                ✦ Tap for more
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lightbox — rendered via portal to escape stacking contexts */}
      {lightboxOpen && cardImage && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95"
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
        </div>,
        document.body
      )}
    </>
  );
}
