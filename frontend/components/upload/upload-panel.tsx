"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search, RotateCcw, Loader2, Sparkles } from "lucide-react";
import { createCheckoutSession } from "@/lib/api";

interface UploadPanelProps {
  photoCount: number;
  analyzing: boolean;
  onAnalyze: () => void;
  onClear: () => void;
  statusText?: string;
  remaining?: number | null;
  limit?: number | null;
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
  limit,
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
      {tier === "pro" && (
        <div className="flex items-center justify-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3 w-3" /> Pro — Unlimited Scans
          </span>
        </div>
      )}
      {tier === "pro" && remaining !== null && remaining !== undefined && remaining <= 5 && !quotaBlocked && (
        <p className="text-center text-xs text-muted-foreground">
          Fair use: {remaining} scan{remaining !== 1 ? "s" : ""} remaining today. Resets at midnight UTC.
        </p>
      )}
      {tier !== "pro" && remaining !== null && remaining !== undefined && !quotaBlocked && (
        <p className="text-center text-xs text-muted-foreground">
          {remaining} of {limit ?? (tier === "anonymous" ? 3 : 5)} {tier === "anonymous" ? "free" : "daily"} scan{remaining !== 1 ? "s" : ""} remaining
        </p>
      )}
      {quotaBlocked && tier === "anonymous" && (
        <p className="text-center text-sm text-muted-foreground">
          You&apos;ve used all free scans.{" "}
          <a href="/" className="text-primary hover:underline">Create a free account</a> for 5 daily scans
        </p>
      )}
      {quotaBlocked && tier === "free" && (
        <div className="text-center text-sm text-muted-foreground">
          <p>Daily limit reached.</p>
          <UpgradeButton />
        </div>
      )}
    </div>
  );
}

function UpgradeButton() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      size="sm"
      disabled={loading}
      className="mt-2 gap-1.5"
      onClick={async () => {
        setLoading(true);
        try {
          const { url } = await createCheckoutSession();
          window.location.href = url;
        } catch {
          setLoading(false);
        }
      }}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      Upgrade to Pro — $7.99/mo
    </Button>
  );
}
