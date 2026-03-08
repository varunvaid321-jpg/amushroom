/**
 * App Review Policy Layer
 *
 * Central gate for all App Store compliance behavior.
 * All upgrade/payment/pricing UI decisions route through here.
 *
 * Rules:
 * - In native iOS/Android app: suppress all upgrade CTAs, pricing, external purchase links
 * - Pro badge and membership state display are always allowed
 * - Free-tier limit messages are allowed but must not include purchase CTAs
 * - Account deletion must be accessible if account creation exists
 */

import { isNativeApp } from "./platform";

/** True when running inside a Capacitor native shell (iOS or Android) */
export { isNativeApp } from "./platform";

/** True when running inside a Capacitor iOS native shell */
export function isIOSNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const cap = (window as any).Capacitor;
    return !!cap && cap.getPlatform?.() === "ios";
  } catch {
    return false;
  }
}

/** Whether upgrade/pricing CTAs can be shown. False in native app. */
export function canShowUpgradeCTA(): boolean {
  return !isNativeApp();
}

/** Whether pricing links (plan cards, dollar amounts in purchase context) can be shown. False in native app. */
export function canShowPricingLinks(): boolean {
  return !isNativeApp();
}

/** Whether external digital purchase links (Stripe checkout, upgrade page) can be shown. False in native app. */
export function canShowExternalDigitalPurchaseLinks(): boolean {
  return !isNativeApp();
}

/** Whether Pro badge / membership state can be displayed. Always true. */
export function canShowProBadge(): boolean {
  return true;
}

/** Whether current membership state (Free/Pro/Lifetime label) can be displayed. Always true. */
export function canShowMembershipState(): boolean {
  return true;
}
