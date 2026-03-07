"use client";

import { useState } from "react";
import { Container } from "@/components/layout/container";
import { useAuth } from "@/hooks/use-auth";
import { useQuota } from "@/hooks/use-quota";
import { createCheckoutSession } from "@/lib/api";
import { Check, Loader2 } from "lucide-react";

const FREE_FEATURES = [
  "5 scans per day",
  "AI-powered identification",
  "Top species matches",
];

const PRO_FEATURES = [
  "Unlimited scans",
  "AI-powered identification",
  "Top species matches",
  "Priority support",
  "Save & revisit past scans",
];

export default function ProPage() {
  const { user, openAuthModal } = useAuth();
  const quota = useQuota();
  const isPro = quota.tier === "pro";

  return (
    <section className="py-16">
      <Container className="max-w-3xl">
        <div className="mb-10 text-center">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-bold text-foreground">
            Choose Your Plan
          </h1>
          <p className="mt-3 text-muted-foreground">
            Start free or go Pro for unlimited mushroom identification.
          </p>
        </div>

        {isPro && (
          <div className="mb-8 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-center text-sm font-medium text-primary">
            You are already a Pro member. Thank you for your support!
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Free plan */}
          <div className="rounded-xl border border-border/50 bg-card p-6">
            <h2 className="text-lg font-bold text-foreground">Free</h2>
            <p className="mt-1 text-3xl font-bold text-foreground">
              $0<span className="text-sm font-normal text-muted-foreground"> / forever</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Great for casual foragers who want to try it out.
            </p>
            <ul className="mt-5 space-y-2.5">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-foreground/80">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {user ? (
                <span className="block text-center text-sm text-muted-foreground">
                  {isPro ? "You have Pro" : "This is your current plan"}
                </span>
              ) : (
                <button
                  onClick={() => openAuthModal("register")}
                  className="w-full rounded-lg border border-border/50 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors"
                >
                  Sign Up Free
                </button>
              )}
            </div>
          </div>

          {/* Pro plan */}
          <div className="rounded-xl border-2 border-primary/50 bg-card p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold text-primary-foreground">
              BEST VALUE
            </div>
            <h2 className="text-lg font-bold text-foreground">Pro</h2>
            <div className="mt-1 flex items-baseline gap-3">
              <div>
                <p className="text-3xl font-bold text-foreground">
                  $49.99<span className="text-sm font-normal text-muted-foreground"> / one time</span>
                </p>
              </div>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              or $7.99/month
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              For serious foragers who want unlimited access.
            </p>
            <ul className="mt-5 space-y-2.5">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-foreground/80">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 space-y-2">
              {isPro ? (
                <span className="block text-center text-sm text-primary font-medium">
                  You have this plan
                </span>
              ) : user ? (
                <>
                  <CheckoutButton plan="lifetime" label="Get Lifetime — $49.99" primary />
                  <CheckoutButton plan="monthly" label="Start Monthly — $7.99/mo" />
                </>
              ) : (
                <>
                  <button
                    onClick={() => openAuthModal("register")}
                    className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Sign Up & Get Lifetime — $49.99
                  </button>
                  <button
                    onClick={() => openAuthModal("register")}
                    className="w-full rounded-lg border border-primary/30 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
                  >
                    Sign Up & Start Monthly — $7.99/mo
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Cancel monthly anytime. Lifetime is a one-time payment — yours forever.
        </p>
      </Container>
    </section>
  );
}

function CheckoutButton({ plan, label, primary }: { plan: "monthly" | "lifetime"; label: string; primary?: boolean }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const { url } = await createCheckoutSession(plan);
          window.location.href = url;
        } catch {
          setLoading(false);
        }
      }}
      className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-primary/30 text-primary hover:bg-primary/10"
      }`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
    </button>
  );
}
