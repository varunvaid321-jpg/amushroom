"use client";

import { useAuth } from "@/hooks/use-auth";
import { useUpgrade } from "@/hooks/use-upgrade";
import { canShowUpgrade } from "@/lib/platform";
import { Container } from "@/components/layout/container";
import { Zap, Shield, Check, Sparkles, Crown, Loader2 } from "lucide-react";

const BENEFITS = [
  { icon: Sparkles, title: "Scan to your heart's content", desc: "Identify as much as you want" },
  { icon: Zap, title: "Instant AI identification", desc: "Powered by millions of verified observations" },
  { icon: Shield, title: "Full edibility & look-alike details", desc: "Every match with complete safety data" },
  { icon: Check, title: "Priority support", desc: "Get help when you need it" },
];

export default function UpgradePage() {
  const { user, loading, openAuthModal } = useAuth();
  const { startCheckout, checkoutLoading } = useUpgrade();
  const isPro = user?.tier === "pro" || user?.tier === "pro_lifetime";

  if (loading) {
    return (
      <Container className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </Container>
    );
  }

  // Native app — no upgrade page
  if (!canShowUpgrade()) {
    return (
      <Container className="py-16 text-center max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-foreground">Manage Your Subscription</h1>
        <p className="mt-2 text-muted-foreground">
          To manage your subscription, visit orangutany.com in your browser.
        </p>
      </Container>
    );
  }

  // Already Pro
  if (isPro) {
    return (
      <Container className="py-16 text-center max-w-lg mx-auto">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
          <Crown className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">You&apos;re a Pro member!</h1>
        <p className="mt-2 text-muted-foreground">
          Enjoy the full Pro experience. Keep identifying mushrooms to your heart&apos;s content.
        </p>
        <a href="/account/billing" className="mt-6 inline-block text-sm text-primary hover:underline">
          View billing &rarr;
        </a>
      </Container>
    );
  }

  function handlePlan(plan: "monthly" | "lifetime") {
    if (!user) {
      openAuthModal("register");
      return;
    }
    startCheckout(plan);
  }

  return (
    <Container className="py-12 max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Upgrade to Pro</h1>
        <p className="mt-2 text-muted-foreground max-w-md mx-auto">
          Get the full mushroom identification experience.
        </p>
      </div>

      {/* Benefits */}
      <div className="grid gap-3 sm:grid-cols-2 mb-10">
        {BENEFITS.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex gap-3 rounded-xl border border-border bg-card p-4">
            <Icon className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Plan cards */}
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        {/* Lifetime - primary */}
        <button
          onClick={() => handlePlan("lifetime")}
          disabled={checkoutLoading}
          className="relative overflow-hidden rounded-2xl border-2 border-primary bg-primary/5 p-6 text-center transition hover:bg-primary/10 disabled:opacity-50"
        >
          <div className="absolute top-3 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
            BEST VALUE
          </div>
          <p className="text-xs font-medium text-primary uppercase tracking-wider">Pro Lifetime</p>
          <p className="mt-2 text-3xl font-bold text-foreground">$49.99</p>
          <p className="text-sm text-muted-foreground">one-time payment</p>
          <p className="mt-3 text-xs text-muted-foreground">Pay once, keep forever</p>
        </button>

        {/* Monthly */}
        <button
          onClick={() => handlePlan("monthly")}
          disabled={checkoutLoading}
          className="rounded-2xl border border-border bg-card p-6 text-center transition hover:border-primary/50 disabled:opacity-50"
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pro Monthly</p>
          <p className="mt-2 text-3xl font-bold text-foreground">$7.99</p>
          <p className="text-sm text-muted-foreground">per month</p>
          <p className="mt-3 text-xs text-muted-foreground">Cancel anytime</p>
        </button>
      </div>

      {!user && (
        <p className="text-center text-sm text-muted-foreground">
          You&apos;ll need to{" "}
          <button onClick={() => openAuthModal("register")} className="text-primary hover:underline font-medium">
            create an account
          </button>{" "}
          or{" "}
          <button onClick={() => openAuthModal("login")} className="text-primary hover:underline font-medium">
            log in
          </button>{" "}
          first.
        </p>
      )}

      <p className="mt-6 text-center text-[11px] text-muted-foreground/60">
        Secure payment via Stripe. Cancel monthly anytime. Lifetime is forever.
      </p>
    </Container>
  );
}
