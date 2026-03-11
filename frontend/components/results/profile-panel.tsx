"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  BookOpen,
  ExternalLink,
  ShieldAlert,
  Leaf,
} from "lucide-react";
import type { Match } from "@/lib/api";
import {
  chipVariant,
  confidenceColor,
  buildReferenceProfileSummary,
  excerptSentences,
} from "@/lib/format-utils";

interface ProfilePanelProps {
  match: Match;
  rank?: number;
}

export function ProfilePanel({
  match,
  rank,
}: ProfilePanelProps) {

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
              {rank && (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  #{rank}
                </span>
              )}
              {match.commonName}
            </CardTitle>
            <p className="text-sm italic text-muted-foreground">
              {match.scientificName}
            </p>
          </div>
          <div
            className={`text-3xl font-bold tabular-nums ${confidenceColor(match.score)}`}
          >
            {match.score}%
            <p className="text-xs font-normal text-muted-foreground">confident</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Badge variant={chipVariant(match.edible)}>
            {match.edible === "Edible" ? (
              <Leaf className="mr-1 h-3 w-3" />
            ) : match.edible === "Poisonous" ? (
              <ShieldAlert className="mr-1 h-3 w-3" />
            ) : null}
            {match.edible === "Unknown" ? "Edibility Unknown" : match.edible}
          </Badge>
          {match.psychedelic !== "Unknown" && match.psychedelic !== "Psychoactivity Unknown" && (
            <Badge variant={chipVariant(match.psychedelic)}>
              Psychoactive: {match.psychedelic}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Did You Know? — curated story from our database */}
        {match.story && (
          <div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2 flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Did You Know?
            </p>
            <p className="text-sm leading-relaxed text-foreground">
              {match.story}
            </p>
          </div>
        )}

        {/* Guide Link — prominent CTA when guide page exists */}
        {match.guideUrl && (
          <a
            href={match.guideUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 transition-colors hover:bg-primary/10"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Read Full Guide</span>
            </div>
            <span className="text-xs text-muted-foreground">Identification, look-alikes, stories &amp; more</span>
          </a>
        )}

        {/* Profile Summary */}
        <div className="flex gap-4">
          {match.representativeImage && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={match.representativeImage}
              alt={match.commonName}
              className="h-24 w-24 flex-shrink-0 rounded-lg object-cover"
            />
          )}
          <p className="text-sm leading-relaxed text-foreground/80">
            {buildReferenceProfileSummary(match)}
          </p>
        </div>

        {/* Key Traits */}
        {match.traits.length > 0 && (
          <>
            <Separator className="bg-border/50" />
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-foreground/60 flex items-center gap-1.5">
                <Leaf className="h-3 w-3 text-green-500" />
                Key Traits
              </h4>
              <div className="flex flex-wrap gap-2">
                {match.traits.map((trait, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-green-500/10 border border-green-500/20 px-3 py-1 text-xs font-medium text-foreground/90"
                  >
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Taxonomy */}
        {match.taxonomy && (
          <>
            <Separator className="bg-border/50" />
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-foreground/60">
                Taxonomy
              </h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {match.taxonomy.genus && (
                  <div className="rounded-lg bg-muted/30 border border-border/50 px-2.5 py-2 text-center">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Genus</span>
                    <p className="font-semibold text-foreground italic">{match.taxonomy.genus}</p>
                  </div>
                )}
                {match.taxonomy.family && (
                  <div className="rounded-lg bg-muted/30 border border-border/50 px-2.5 py-2 text-center">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Family</span>
                    <p className="font-semibold text-foreground">{match.taxonomy.family}</p>
                  </div>
                )}
                {match.taxonomy.order && (
                  <div className="rounded-lg bg-muted/30 border border-border/50 px-2.5 py-2 text-center">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Order</span>
                    <p className="font-semibold text-foreground">{match.taxonomy.order}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Look-Alikes */}
        {match.lookAlikes.length > 0 && (
          <>
            <Separator className="bg-border/50" />
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Don&apos;t Confuse With
              </h4>
              <div className="space-y-3">
                {match.lookAlikes.map((la, i) => {
                  if (typeof la === "string") {
                    return (
                      <div key={i} className="flex items-start gap-1.5 text-sm text-foreground/80">
                        <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-yellow-400" />
                        {la}
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="flex gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                      {la.imageUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={la.imageUrl}
                          alt={la.name}
                          className="h-16 w-16 flex-shrink-0 rounded-md object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{la.name}</p>
                        {la.distinction && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{la.distinction}</p>
                        )}
                        {la.slug && (
                          <a
                            href={`https://guide.orangutany.com/mushrooms/${la.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Read full guide <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Why Match */}
        {match.whyMatch.length > 0 && (
          <>
            <Separator className="bg-border/50" />
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-foreground/60 flex items-center gap-1.5">
                <ShieldAlert className="h-3 w-3 text-blue-400" />
                Technical Markers
              </h4>
              <div className="space-y-1.5">
                {match.whyMatch.map((m, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-blue-500/5 border border-blue-500/10 px-3 py-1.5 text-xs text-foreground/80">
                    <span className="mt-0.5 inline-block h-1 w-1 rounded-full bg-blue-400 flex-shrink-0" />
                    {m}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Caution */}
        {match.caution && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
            <ShieldAlert className="mr-1 inline h-4 w-4 text-destructive" />
            {match.caution}
          </div>
        )}

        {/* Description */}
        {match.description && (
          <>
            <Separator className="bg-border/50" />
            <p className="text-sm leading-relaxed text-foreground/70">
              {excerptSentences(match.description, 3, 400)}
            </p>
          </>
        )}

        {/* Global Distribution Map */}
        {match.gbifId && (
          <>
            <Separator className="bg-border/50" />
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Where It&apos;s Found Worldwide
              </h4>
              <div className="relative overflow-hidden rounded-xl border border-border/50" style={{ aspectRatio: '2/1', background: '#0a1628' }}>
                {/* Base map — land outlines */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://tile.openstreetmap.org/0/0/0.png"
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                  aria-hidden="true"
                />
                {/* Occurrence heatmap overlay */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.gbif.org/v2/map/occurrence/density/0/0/0@2x.png?style=classic.point&taxonKey=${match.gbifId}`}
                  alt={`Where ${match.commonName} has been recorded worldwide`}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
                {/* Legend */}
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded bg-black/60 px-2 py-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-yellow-400"></span>
                  <span className="text-[10px] text-white/80">Recorded sightings</span>
                </div>
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
          </>
        )}

        {/* Wiki Link */}
        {match.wikiUrl && (
          <a
            href={match.wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Learn more on Wikipedia
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}
