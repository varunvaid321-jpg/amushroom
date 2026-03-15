"use client";

import { useAuth } from "@/hooks/use-auth";
import { useUpgrade } from "@/hooks/use-upgrade";
import { createPortalSession, cancelSubscription } from "@/lib/api";
import { Container } from "@/components/layout/container";
import { Crown, Loader2, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";

export default function BillingPage() {
  const { user, loading, openAuthModal, refresh } = useAuth();
  const { startCheckout, openUpgrade } = useUpgrade();
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [cancelConfirming, setCancelConfirming] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  // Reset portalLoading when page is restored from bfcache (browser Back button)
  useEffect(() => {
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        setPortalLoading(false);
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  if (loading) {
    return (
      <Container className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </Container>
    );
  }

  if (!user) {
    return (
      <Container className="py-16 text-center max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-foreground">Account & Billing</h1>
        <p className="mt-2 text-muted-foreground">You need to be logged in to view billing.</p>
        <button
          onClick={() => openAuthModal("login")}
          className="mt-4 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Log in
        </button>
      </Container>
    );
  }

  const isPro = user.tier === "pro" || user.tier === "pro_lifetime";
  const isLifetime = user.tier === "pro_lifetime";
  const isMonthly = user.tier === "pro";

  async function openPortal() {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch {
      setPortalLoading(false);
      setPortalError("Could not open billing portal. Please try again.");
    }
  }

  async function handleCancel() {
    setCancelLoading(true);
    setCancelError(null);
    try {
      await cancelSubscription();
      setCancelSuccess(true);
      setCancelConfirming(false);
      // Refresh user state so the page reflects the new tier
      await refresh();
    } catch {
      setCancelLoading(false);
      setCancelError("Could not cancel subscription. Please try again or contact support.");
    }
  }

  const tierLabel = isLifetime ? "Pro Lifetime" : isMonthly ? "Pro Monthly" : "Free";
  const tierColor = isLifetime
    ? "bg-purple-500/15 text-purple-400"
    : isMonthly
      ? "bg-green-500/15 text-green-400"
      : "bg-muted text-muted-foreground";

  return (
    <Container className="py-12 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-foreground mb-6">Account & Billing</h1>

      {/* Cancellation success message */}
      {cancelSuccess && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-5 mb-6">
          <p className="text-sm font-semibold text-green-400 mb-1">Subscription cancelled</p>
          <p className="text-xs text-muted-foreground">
            Your Pro membership has been cancelled. You&apos;re now on the free plan with 5 daily scans.
            You can upgrade again anytime.
          </p>
        </div>
      )}

      {/* Membership card */}
      <div className="rounded-2xl border border-border bg-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isPro ? "bg-primary/15" : "bg-muted"}`}>
            <Crown className={`h-5 w-5 ${isPro ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="font-semibold text-foreground">{user.name || user.email}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Membership</span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tierColor}`}>
              {tierLabel}
            </span>
          </div>

          {isPro && user.membershipStartedAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Member since</span>
              <span className="text-sm text-foreground">
                {new Date(user.membershipStartedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </span>
            </div>
          )}

          {!isPro && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Daily scans</span>
              <span className="text-sm text-foreground">5 / day</span>
            </div>
          )}

          {isMonthly && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Plan</span>
                <span className="text-sm text-foreground">$7.99 / month</span>
              </div>
              {user.membershipExpiresAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Renews on</span>
                  <span className="text-sm text-foreground">
                    {new Date(user.membershipExpiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              )}
            </>
          )}

          {isLifetime && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plan</span>
              <span className="text-sm text-foreground">$49.99 one-time (paid)</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {/* Free user - upgrade */}
        {!isPro && !cancelSuccess && (
          <button
            onClick={openUpgrade}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition"
          >
            Upgrade to Pro
          </button>
        )}

        {/* Monthly user - cancel or upgrade to lifetime */}
        {isMonthly && (
          <>
            <button
              onClick={() => startCheckout("lifetime")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 px-6 py-3 text-sm font-medium text-primary hover:bg-primary/10 transition"
            >
              Switch to Lifetime ($49.99 one-time)
            </button>

            {/* Cancel subscription - in-app */}
            {!cancelConfirming ? (
              <button
                onClick={() => setCancelConfirming(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition"
              >
                Cancel Subscription
              </button>
            ) : (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
                <p className="text-sm font-semibold text-red-400 mb-2">Cancel your subscription?</p>
                <p className="text-xs text-muted-foreground mb-4">
                  You&apos;ll lose Pro benefits immediately and return to the free plan (5 scans/day).
                  You can re-subscribe anytime.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    disabled={cancelLoading}
                    className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    {cancelLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, cancel"}
                  </button>
                  <button
                    onClick={() => { setCancelConfirming(false); setCancelError(null); }}
                    disabled={cancelLoading}
                    className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Keep my subscription
                  </button>
                </div>
                {cancelError && (
                  <p className="mt-3 text-sm text-red-400">{cancelError}</p>
                )}
              </div>
            )}
          </>
        )}

        {portalError && (
          <p className="text-sm text-red-400 text-center">{portalError}</p>
        )}

        {/* Lifetime user - portal for receipts only */}
        {isLifetime && user.hasStripeCustomer && (
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition disabled:opacity-50"
          >
            {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            View Receipts
          </button>
        )}
      </div>

      <p className="mt-8 text-center text-[11px] text-muted-foreground/60">
        Payments processed securely by Stripe.
      </p>
    </Container>
  );
}
