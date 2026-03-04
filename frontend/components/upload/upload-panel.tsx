"use client";

import { Button } from "@/components/ui/button";
import { Search, RotateCcw, Loader2 } from "lucide-react";

interface UploadPanelProps {
  photoCount: number;
  analyzing: boolean;
  onAnalyze: () => void;
  onClear: () => void;
  statusText?: string;
  remaining?: number | null;
  tier?: string;
  quotaBlocked?: boolean;
}

export function UploadPanel({
  photoCount,
  analyzing,
  onAnalyze,
  onClear,
  statusText,
  remaining,
  tier,
  quotaBlocked,
}: UploadPanelProps) {
  const isDisabled = photoCount === 0 || analyzing || quotaBlocked;

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button
          size="lg"
          disabled={isDisabled}
          onClick={onAnalyze}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {analyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Analyze {photoCount > 0 ? `${photoCount} Photo${photoCount > 1 ? "s" : ""}` : "Photos"}
            </>
          )}
        </Button>
        {photoCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={analyzing}
            className="text-muted-foreground"
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            New Scan
          </Button>
        )}
      </div>
      {statusText && (
        <p className="text-center text-sm text-muted-foreground" role="status" aria-live="polite">
          {statusText}
        </p>
      )}
      {remaining !== null && remaining !== undefined && !quotaBlocked && (
        <p className="text-center text-xs text-muted-foreground">
          {remaining} of {tier === "anonymous" ? "5 free" : "5 daily"} scan{remaining !== 1 ? "s" : ""} remaining
        </p>
      )}
      {quotaBlocked && tier === "anonymous" && (
        <p className="text-center text-sm text-muted-foreground">
          You&apos;ve used all free scans.{" "}
          <a href="/auth" className="text-primary hover:underline">Create a free account</a> for 5 scans per day.
        </p>
      )}
      {quotaBlocked && tier === "free" && (
        <p className="text-center text-sm text-muted-foreground">
          Daily limit reached. Come back tomorrow or upgrade to Pro.
        </p>
      )}
    </div>
  );
}
