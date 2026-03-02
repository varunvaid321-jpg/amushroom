"use client";

import { useCallback, useEffect, useState } from "react";
import { listUploads, type UploadSummary } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { PortfolioCard } from "./portfolio-card";
import { StatsCards } from "./stats-cards";
import { Loader2, FolderOpen } from "lucide-react";
import { Container } from "@/components/layout/container";

interface PortfolioGridProps {
  onLoadUpload: (uploadId: string) => void;
}

export function PortfolioGrid({ onLoadUpload }: PortfolioGridProps) {
  const { user } = useAuth();
  const [uploads, setUploads] = useState<UploadSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await listUploads();
      setUploads(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!user) return null;

  return (
    <section className="py-12">
      <Container>
        <h2 className="mb-6 font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          Your Saved Identifications
        </h2>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : uploads.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center text-muted-foreground">
            <FolderOpen className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm">No saved scans yet. Analyze some mushrooms!</p>
          </div>
        ) : (
          <div className="space-y-6">
            <StatsCards uploads={uploads} />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {uploads.map((u) => (
                <PortfolioCard
                  key={u.id}
                  upload={u}
                  onClick={() => onLoadUpload(u.id)}
                />
              ))}
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}
