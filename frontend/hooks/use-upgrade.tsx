"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { createCheckoutSession } from "@/lib/api";
import { track } from "@/lib/track";

type PendingAction = { plan: "monthly" | "lifetime" } | null;

interface UpgradeContextType {
  openUpgrade: () => void;
  closeUpgrade: () => void;
  upgradeOpen: boolean;
  /** Start checkout — handles auth gate seamlessly */
  startCheckout: (plan: "monthly" | "lifetime") => void;
  /** Cancel a pending upgrade (after login, user can bail) */
  cancelPending: () => void;
  checkoutLoading: boolean;
  /** Message to show user during redirect */
  redirectMessage: string | null;
}

const UpgradeContext = createContext<UpgradeContextType>({
  openUpgrade: () => {},
  closeUpgrade: () => {},
  upgradeOpen: false,
  startCheckout: () => {},
  cancelPending: () => {},
  checkoutLoading: false,
  redirectMessage: null,
});

export function UpgradeProvider({ children }: { children: ReactNode }) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [redirectMessage, setRedirectMessage] = useState<string | null>(null);
  const pendingPlan = useRef<PendingAction>(null);
  const { user, openAuthModal } = useAuth();

  // Restore pending plan from sessionStorage (survives Google OAuth redirect)
  useEffect(() => {
    const stored = sessionStorage.getItem("pendingUpgradePlan");
    if (stored && !pendingPlan.current) {
      pendingPlan.current = { plan: stored as "monthly" | "lifetime" };
    }
  }, []);

  const openUpgrade = useCallback(() => setUpgradeOpen(true), []);
  const closeUpgrade = useCallback(() => setUpgradeOpen(false), []);

  const doCheckout = useCallback((plan: "monthly" | "lifetime") => {
    const planLabel = plan === "lifetime" ? "$49.99 Lifetime" : "$7.99/month";
    setRedirectMessage(`You're logged in! Taking you to checkout for ${planLabel}...`);
    setCheckoutLoading(true);
    createCheckoutSession(plan)
      .then(({ url }) => {
        window.location.href = url;
      })
      .catch(() => {
        setCheckoutLoading(false);
        setRedirectMessage("Something went wrong starting checkout. Please try again.");
        setTimeout(() => setRedirectMessage(null), 5000);
      });
  }, []);

  const startCheckout = useCallback(
    (plan: "monthly" | "lifetime") => {
      track("button_click", { button: "upgrade", plan });
      if (!user) {
        pendingPlan.current = { plan };
        sessionStorage.setItem("pendingUpgradePlan", plan);
        setUpgradeOpen(false);
        openAuthModal("register");
        return;
      }
      setUpgradeOpen(false);
      doCheckout(plan);
    },
    [user, openAuthModal, doCheckout]
  );

  const cancelPending = useCallback(() => {
    pendingPlan.current = null;
    sessionStorage.removeItem("pendingUpgradePlan");
    setCheckoutLoading(false);
    setRedirectMessage(null);
  }, []);

  // Reset loading state when page is restored from bfcache (browser Back button)
  useEffect(() => {
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        setCheckoutLoading(false);
        setRedirectMessage(null);
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  // After login/register, if there's a pending plan, auto-checkout
  useEffect(() => {
    if (user && pendingPlan.current) {
      const { plan } = pendingPlan.current;
      pendingPlan.current = null;
      sessionStorage.removeItem("pendingUpgradePlan");
      doCheckout(plan);
    }
  }, [user, doCheckout]);

  return (
    <UpgradeContext.Provider
      value={{ openUpgrade, closeUpgrade, upgradeOpen, startCheckout, cancelPending, checkoutLoading, redirectMessage }}
    >
      {children}
    </UpgradeContext.Provider>
  );
}

export function useUpgrade() {
  return useContext(UpgradeContext);
}
