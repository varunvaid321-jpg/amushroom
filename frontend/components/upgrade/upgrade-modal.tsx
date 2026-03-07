"use client";

import { Sparkles, Zap, Shield, Loader2, X, Check, Crown } from "lucide-react";
import { useUpgrade } from "@/hooks/use-upgrade";
import { useAuth } from "@/hooks/use-auth";

const BENEFITS = [
  { icon: Sparkles, text: "Scan to your heart's content" },
  { icon: Zap, text: "Instant AI identification" },
  { icon: Shield, text: "Priority support" },
  { icon: Check, text: "Full edibility and look-alike details" },
];

export function UpgradeModal() {
  const { upgradeOpen, closeUpgrade, startCheckout, checkoutLoading, redirectMessage, cancelPending } = useUpgrade();
  const { user } = useAuth();
  const isPro = user?.tier === "pro" || user?.tier === "pro_lifetime";

  // Show redirect confirmation when going to Stripe after login
  if (redirectMessage) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative mx-4 w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl text-center">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">{redirectMessage}</p>
          <button
            onClick={cancelPending}
            className="mt-4 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel and stay here
          </button>
        </div>
      </div>
    );
  }

  if (!upgradeOpen) return null;

  // Already Pro — show confirmation
  if (isPro) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeUpgrade} />
        <div className="relative mx-4 w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl text-center">
          <button onClick={closeUpgrade} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
            <Crown className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground">You&apos;re already a Pro member!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enjoy the full Pro experience. Keep identifying mushrooms to your heart&apos;s content.
          </p>
          <button
            onClick={closeUpgrade}
            className="mt-5 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeUpgrade}
      />
      <div className="relative mx-4 w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={closeUpgrade}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Upgrade to Pro</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The full mushroom identification experience.
          </p>
        </div>

        <ul className="mb-6 space-y-2.5">
          {BENEFITS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-foreground/80">
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              {text}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-3 sm:flex-row">
          <PlanButton
            plan="lifetime"
            label="$49.99"
            sublabel="one time"
            primary
            onClick={startCheckout}
            loading={checkoutLoading}
          />
          <PlanButton
            plan="monthly"
            label="$7.99"
            sublabel="per month"
            onClick={startCheckout}
            loading={checkoutLoading}
          />
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground/60">
          Cancel monthly anytime. Lifetime is forever. Powered by Stripe.
        </p>
      </div>
    </div>
  );
}

function PlanButton({
  plan,
  label,
  sublabel,
  primary,
  onClick,
  loading,
}: {
  plan: "monthly" | "lifetime";
  label: string;
  sublabel: string;
  primary?: boolean;
  onClick: (plan: "monthly" | "lifetime") => void;
  loading: boolean;
}) {
  return (
    <button
      disabled={loading}
      className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-4 py-3.5 text-sm font-semibold transition-colors ${
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-primary/30 text-primary hover:bg-primary/10"
      } disabled:opacity-50`}
      onClick={() => onClick(plan)}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <span className="text-base">{label}</span>
          <span
            className={`text-[11px] font-normal ${
              primary ? "text-primary-foreground/70" : "text-muted-foreground"
            }`}
          >
            {sublabel}
          </span>
        </>
      )}
    </button>
  );
}
