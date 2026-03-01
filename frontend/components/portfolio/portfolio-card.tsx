"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { UploadSummary } from "@/lib/api";
import { confidenceColor } from "@/lib/format-utils";

interface PortfolioCardProps {
  upload: UploadSummary;
  onClick: () => void;
}

export function PortfolioCard({ upload, onClick }: PortfolioCardProps) {
  const date = new Date(upload.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Card
      className="cursor-pointer border-border/50 bg-card transition-colors hover:border-primary/30 hover:bg-muted/30"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="mb-3 aspect-square overflow-hidden rounded-lg bg-muted/20">
          {upload.coverPreview ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={upload.coverPreview}
              alt={upload.primaryMatch}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/30 text-xs">
              No preview
            </div>
          )}
        </div>
        <h4 className="truncate text-sm font-semibold text-foreground">
          {upload.matches[0]?.commonName || upload.primaryMatch}
        </h4>
        <p className="truncate text-xs italic text-muted-foreground">
          {upload.primaryMatch}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className={`text-sm font-bold tabular-nums ${confidenceColor(upload.primaryConfidence)}`}>
            {upload.primaryConfidence}%
          </span>
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>
        {upload.mixedSpecies && (
          <Badge variant="outline" className="mt-2 text-xs text-yellow-400">
            Mixed species
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
