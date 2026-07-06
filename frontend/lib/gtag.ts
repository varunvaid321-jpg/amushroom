// Google Ads conversion tracking. Entirely inert unless NEXT_PUBLIC_GOOGLE_ADS_ID
// is set at build time — no script loads, no events fire, zero behavior change.
// IDs come from the Google Ads console once the account exists.

export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "";
const SIGNUP_LABEL = process.env.NEXT_PUBLIC_GADS_SIGNUP_LABEL || "";
const PURCHASE_LABEL = process.env.NEXT_PUBLIC_GADS_PURCHASE_LABEL || "";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function conversion(label: string, params: Record<string, unknown> = {}) {
  if (!GOOGLE_ADS_ID || !label || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", "conversion", { send_to: `${GOOGLE_ADS_ID}/${label}`, ...params });
}

/** Fire after a successful account registration. */
export function trackSignupConversion() {
  conversion(SIGNUP_LABEL);
}

/** Fire on return from successful Stripe checkout. */
export function trackPurchaseConversion(plan: string | null) {
  const value = plan === "lifetime" ? 49.99 : plan === "monthly" ? 7.99 : undefined;
  conversion(PURCHASE_LABEL, value !== undefined ? { value, currency: "USD" } : {});
}
