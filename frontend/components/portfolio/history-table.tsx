"use client";

import { useCallback, useEffect, useState } from "react";
import { listUploads, type UploadSummary } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { confidenceColor } from "@/lib/format-utils";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  History,
  ExternalLink,
  ImageIcon,
  AlertTriangle,
} from "lucide-react";

const PAGE_SIZE = 10;

interface HistoryTableProps {
  onLoadUpload: (uploadId: string) => void;
  refreshKey?: number;
}

export function HistoryTable({ onLoadUpload, refreshKey }: HistoryTableProps) {
  const { user } = useAuth();
  const [uploads, setUploads] = useState<UploadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchUploads = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await listUploads(100);
      setUploads(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads, refreshKey]);

  if (!user) return null;

  const totalPages = Math.max(1, Math.ceil(uploads.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(page, totalPages);
  const startIdx = (safeCurrentPage - 1) * PAGE_SIZE;
  const pageUploads = uploads.slice(startIdx, startIdx + PAGE_SIZE);

  if (loading) {
    return (
      <section className="border-t border-border/50 py-12">
        <Container>
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </Container>
      </section>
    );
  }

  if (uploads.length === 0) {
    return (
      <section className="border-t border-border/50 py-12">
        <Container>
          <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
            <History className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm">No identification history yet.</p>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section className="border-t border-border/50 py-12">
      <Container>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
            Identification History
          </h2>
          <span className="text-sm text-muted-foreground">
            {uploads.length} scan{uploads.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Stats row */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatPill label="Total Scans" value={uploads.length} />
          <StatPill
            label="Photos Analyzed"
            value={uploads.reduce((s, u) => s + u.imageCount, 0)}
          />
          <StatPill
            label="Avg Confidence"
            value={`${uploads.length > 0 ? Math.round(uploads.reduce((s, u) => s + u.primaryConfidence, 0) / uploads.length) : 0}%`}
          />
          <StatPill
            label="Unique Species"
            value={new Set(uploads.map((u) => u.primaryMatch)).size}
          />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-border/50">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Photos
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Top Match
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Confidence
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Summary
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageUploads.map((u) => (
                  <HistoryRow key={u.id} upload={u} onView={() => onLoadUpload(u.id)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={safeCurrentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Button
                key={p}
                variant={p === safeCurrentPage ? "default" : "ghost"}
                size="sm"
                className={
                  p === safeCurrentPage
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }
                onClick={() => setPage(p)}
              >
                {p}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Container>
    </section>
  );
}

function HistoryRow({
  upload,
  onView,
}: {
  upload: UploadSummary;
  onView: () => void;
}) {
  const date = new Date(upload.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = new Date(upload.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const topMatch = upload.topMatches[0];
  const displayName = topMatch?.commonName || upload.primaryMatch;
  const sciName = topMatch?.scientificName || upload.primaryMatch;

  // Build summary from available matches
  const matchSummary =
    upload.topMatches.length > 1
      ? `Also: ${upload.topMatches
          .slice(1)
          .map((m) => m.commonName)
          .join(", ")}`
      : "Single match";

  return (
    <tr className="border-b border-border/30 transition-colors hover:bg-muted/20">
      <td className="px-4 py-3">
        <div className="text-foreground">{date}</div>
        <div className="text-xs text-muted-foreground">{time}</div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {upload.coverImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={upload.coverImageUrl}
              alt=""
              className="h-8 w-8 rounded object-cover"
            />
          ) : (
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-foreground/80">
            {upload.imageCount} photo{upload.imageCount !== 1 ? "s" : ""}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{displayName}</div>
        <div className="text-xs italic text-muted-foreground">{sciName}</div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`font-bold tabular-nums ${confidenceColor(upload.primaryConfidence)}`}
        >
          {upload.primaryConfidence}%
        </span>
        {upload.mixedSpecies && (
          <AlertTriangle className="ml-1 inline h-3 w-3 text-yellow-400" />
        )}
      </td>
      <td className="max-w-[200px] px-4 py-3">
        <p className="truncate text-xs text-muted-foreground">{matchSummary}</p>
      </td>
      <td className="px-4 py-3 text-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={onView}
          className="text-primary hover:text-primary/80"
        >
          View
          <ExternalLink className="ml-1 h-3 w-3" />
        </Button>
      </td>
    </tr>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
