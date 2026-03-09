"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  Leaf,
} from "lucide-react";
import type { Match } from "@/lib/api";
import {
  chipVariant,
  confidenceColor,
  firstSentence,
} from "@/lib/format-utils";

interface MatchCardProps {
  match: Match;
  rank: number;
}

export function MatchCard({ match, rank }: MatchCardProps) {
  return (
    <Card className="border-border/50 bg-card">
      <CardContent className="space-y-3 p-4">
        <div className="flex gap-3">
          {match.representativeImage && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={match.representativeImage}
              alt={match.commonName}
              className="h-20 w-20 flex-shrink-0 rounded-lg object-cover"
            />
          )}
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                  #{rank}
                </span>
                <div>
                  <h4 className="font-semibold text-foreground">{match.commonName}</h4>
                  <p className="text-xs italic text-muted-foreground">
                    {match.scientificName}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-lg font-bold tabular-nums ${confidenceColor(match.score)}`}>
                  {match.score}%
                </span>
                <p className="text-[10px] text-muted-foreground">confident</p>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant={chipVariant(match.edible)} className="text-xs">
                {match.edible === "Edible" ? (
                  <Leaf className="mr-1 h-3 w-3" />
                ) : match.edible === "Poisonous" ? (
                  <ShieldAlert className="mr-1 h-3 w-3" />
                ) : null}
                {match.edible === "Unknown" ? "Edibility Unknown" : match.edible}
              </Badge>
              {match.psychedelic !== "Unknown" && match.psychedelic !== "Psychoactivity Unknown" && (
                <Badge variant={chipVariant(match.psychedelic)} className="text-xs">
                  Psychoactive: {match.psychedelic}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {match.traits.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {match.traits.slice(0, 4).map((t, i) => (
              <span
                key={i}
                className="rounded bg-muted/50 px-2 py-0.5 text-xs text-foreground/70"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {match.description && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {firstSentence(match.description)}
          </p>
        )}

        {match.lookAlikes.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <AlertTriangle className="mr-1 inline h-3 w-3 text-yellow-400" />
            Don&apos;t confuse with: {match.lookAlikes.slice(0, 2).map((la) =>
              typeof la === "string" ? la : la.name
            ).join(", ")}
          </div>
        )}

        {match.caution && (
          <div className="rounded bg-destructive/10 px-2 py-1.5 text-xs text-foreground">
            <ShieldAlert className="mr-0.5 inline h-3 w-3 text-destructive" />
            {match.caution}
          </div>
        )}

        {match.gbifId && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Global Distribution</p>
            <div className="relative overflow-hidden rounded-lg border border-border/50" style={{ aspectRatio: '2/1', background: '#0a1628' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://tile.openstreetmap.org/0/0/0.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" aria-hidden="true" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.gbif.org/v2/map/occurrence/density/0/0/0@2x.png?style=classic.point&taxonKey=${match.gbifId}`}
                alt={`Where ${match.commonName} has been recorded worldwide`}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <a
              href={`https://www.gbif.org/species/${match.gbifId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Explore where this species has been found worldwide <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {match.guideUrl && (
            <a
              href={match.guideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Full guide <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {match.wikiUrl && (
            <a
              href={match.wikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Wikipedia <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
