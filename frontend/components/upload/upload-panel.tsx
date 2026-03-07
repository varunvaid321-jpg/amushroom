"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search, RotateCcw, Loader2, Sparkles, Zap, Shield, Infinity } from "lucide-react";
import { useUpgrade } from "@/hooks/use-upgrade";

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
  const { openUpgrade } = useUpgrade();
  const isDisabled = photoCount === 0 || analyzing || quotaBlocked;
  const isFree = tier === "free" || tier === "anonymous";

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
          {" "}&middot;{" "}
          <button onClick={openUpgrade} className="font-semibold text-primary hover:underline">
            Go unlimited
          </button>
        </p>
      )}
      {quotaBlocked && tier === "anonymous" && (
        <div className="mx-auto max-w-sm rounded-xl border border-primary/30 bg-primary/5 p-5 text-center">
          <Sparkles className="mx-auto mb-2 h-5 w-5 text-primary" />
          <p className="mb-1 text-sm font-semibold text-foreground">You&apos;ve used all free scans</p>
          <p className="mb-3 text-xs text-muted-foreground">Create a free account to get 5 scans every day, or go Pro for unlimited.</p>
          <a href="/" className="inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            Sign Up Free
          </a>
        </div>
      )}
      {quotaBlocked && tier === "free" && <UpgradeCard />}
    </div>
  );
}

function UpgradeCard() {
  const { startCheckout, checkoutLoading } = useUpgrade();
  return (
    <div className="mx-auto max-w-sm rounded-xl border border-primary/30 bg-primary/5 p-5">
      <div className="mb-3 flex items-center justify-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold text-foreground">Unlock Unlimited Scans</h3>
      </div>
      <p className="mb-4 text-center text-sm text-muted-foreground">
        You&apos;ve hit your daily limit. Go Pro and never worry about limits again.
      </p>
      <div className="mb-4 flex justify-center gap-4 text-xs text-foreground/70">
        <span className="flex items-center gap-1"><Infinity className="h-3.5 w-3.5 text-primary" /> Unlimited scans</span>
        <span className="flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-primary" /> Instant results</span>
        <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5 text-primary" /> Priority support</span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          disabled={checkoutLoading}
          onClick={() => startCheckout("lifetime")}
          className="flex flex-1 flex-col items-center gap-0.5 rounded-lg px-4 py-3 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span className="text-base">$49.99</span><span className="text-[11px] font-normal text-primary-foreground/70">one time</span></>}
        </button>
        <button
          disabled={checkoutLoading}
          onClick={() => startCheckout("monthly")}
          className="flex flex-1 flex-col items-center gap-0.5 rounded-lg px-4 py-3 text-sm font-semibold border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span className="text-base">$7.99</span><span className="text-[11px] font-normal text-muted-foreground">per month</span></>}
        </button>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground/60">Cancel monthly anytime. Lifetime is forever.</p>
    </div>
  );
}
