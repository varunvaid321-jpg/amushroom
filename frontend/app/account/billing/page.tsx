"use client";

import { useAuth } from "@/hooks/use-auth";
import { useUpgrade } from "@/hooks/use-upgrade";
import { canShowUpgradeCTA } from "@/lib/app-review-policy";
import { createPortalSession, deleteAccount } from "@/lib/api";
import { Container } from "@/components/layout/container";
import { Crown, Loader2, ExternalLink } from "lucide-react";
import { useState } from "react";

export default function BillingPage() {
  const { user, loading, openAuthModal } = useAuth();
  const { startCheckout } = useUpgrade();
  const [portalLoading, setPortalLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch {
      setPortalLoading(false);
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
        {!isPro && canShowUpgradeCTA() && (
          <a
            href="/upgrade"
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition"
          >
            Upgrade to Pro
          </a>
        )}

        {/* Monthly user - manage subscription via Stripe portal */}
        {isMonthly && user.hasStripeCustomer && (
          <>
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition disabled:opacity-50"
            >
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Manage Subscription
            </button>
            {canShowUpgradeCTA() && (
              <button
                onClick={() => startCheckout("lifetime")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 px-6 py-3 text-sm font-medium text-primary hover:bg-primary/10 transition"
              >
                Upgrade to Lifetime ($49.99)
              </button>
            )}
          </>
        )}

        {/* Lifetime user - portal for receipts */}
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
        Payments processed securely by Stripe. Cancel monthly anytime via Manage Subscription.
      </p>

      {/* Danger zone */}
      <div className="mt-10 rounded-xl border border-destructive/30 p-5">
        <h2 className="text-sm font-semibold text-destructive mb-2">Danger Zone</h2>
        {!deleteConfirm ? (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Permanently delete your account and all data.</p>
            <button
              onClick={() => setDeleteConfirm(true)}
              className="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
            >
              Delete Account
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              This will permanently delete your account, all identifications, saved photos, and account data. This cannot be undone.
            </p>
            {isPro && (
              <p className="text-xs text-muted-foreground">
                Your subscription will be cancelled automatically.
              </p>
            )}
            <div className="flex items-center gap-3">
              <button
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await deleteAccount();
                    window.location.href = "/";
                  } catch {
                    setDeleting(false);
                    setDeleteConfirm(false);
                  }
                }}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Yes, Delete My Account"}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                disabled={deleting}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Container>
  );
}
