"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Camera, Scan, Target, Trees } from "lucide-react";
import type { UploadSummary } from "@/lib/api";

interface StatsCardsProps {
  uploads: UploadSummary[];
}

export function StatsCards({ uploads }: StatsCardsProps) {
  const totalScans = uploads.length;
  const totalPhotos = uploads.reduce((s, u) => s + u.imageCount, 0);
  const withConf = uploads.filter((u) => u.primaryConfidence != null);
  const avgConfidence =
    withConf.length > 0
      ? Math.round(
          withConf.reduce((s, u) => s + (u.primaryConfidence ?? 0), 0) / withConf.length,
        )
      : 0;
  const uniqueSpecies = new Set(uploads.map((u) => u.primaryMatch)).size;

  const stats = [
    { label: "Scans", value: totalScans, icon: Scan },
    { label: "Photos", value: totalPhotos, icon: Camera },
    { label: "Avg Confidence", value: `${avgConfidence}%`, icon: Target },
    { label: "Unique Species", value: uniqueSpecies, icon: Trees },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label} className="border-border/50 bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <s.icon className="h-5 w-5 text-primary" />
            <div>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
