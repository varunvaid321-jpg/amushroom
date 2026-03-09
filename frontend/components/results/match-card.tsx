"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ShieldAlert,
  Leaf,
  ChevronDown,
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
  return (
    <Card
      className={`border-border/50 bg-card cursor-pointer transition-all hover:border-primary/30 ${
        isExpanded ? "ring-2 ring-primary/40 border-primary/50" : ""
      }`}
      onClick={onToggle}
    >
      <CardContent className="p-4">
        {/* Rank badge + confidence */}
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

        {/* Image */}
        {match.representativeImage && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={match.representativeImage}
            alt={match.commonName}
            className="w-full h-32 rounded-lg object-cover mb-3"
          />
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

        {/* Story teaser */}
        {match.story && (
          <p className="mt-3 text-xs text-muted-foreground line-clamp-2">
            {match.story}
          </p>
        )}

        {/* Expand indicator */}
        <div className="mt-3 flex items-center justify-center">
          <ChevronDown className={`h-4 w-4 text-muted-foreground/50 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </div>
      </CardContent>
    </Card>
  );
}
