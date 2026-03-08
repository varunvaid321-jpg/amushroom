# iOS Payment Surface Audit

Each payment/upgrade surface in the app, with current web behavior, required iOS native behavior, and action taken.

## Suppressed Surfaces

### 1. Header Upgrade Button
- **File**: `frontend/components/layout/header.tsx:83-92`
- **Web behavior**: Shows "Upgrade" sparkle button for free/anonymous users.
- **iOS native behavior**: Hidden.
- **Action**: `canShowUpgradeCTA()` gates the `showUpgrade` variable. Button does not render when false.

### 2. Header Hamburger "Upgrade to Pro"
- **File**: `frontend/components/layout/header.tsx:133-141`
- **Web behavior**: Shows "Upgrade to Pro" menu item in hamburger menu.
- **iOS native behavior**: Hidden.
- **Action**: `canShowUpgradeCTA()` wraps the rendering condition. Menu item removed in native.

### 3. Upload Panel "Go Pro" Link
- **File**: `frontend/components/upload/upload-panel.tsx:79-81`
- **Web behavior**: Shows "Go Pro" link after scan count text.
- **iOS native behavior**: Hidden.
- **Action**: `canShowUpgradeCTA()` gates rendering. Scan count text remains, link removed.

### 4. Upload Panel Anonymous Block
- **File**: `frontend/components/upload/upload-panel.tsx:84-101`
- **Web behavior**: Shows "or Upgrade to Pro" link alongside "Sign Up Free".
- **iOS native behavior**: "Upgrade to Pro" link hidden. "Sign Up Free" remains. Copy adjusted to remove sales language.
- **Action**: `canShowUpgradeCTA()` hides the upgrade link. Sign-up CTA preserved.

### 5. Upload Panel Free-Tier UpgradeCard
- **File**: `frontend/components/upload/upload-panel.tsx:103`
- **Web behavior**: Shows pricing card with upgrade options.
- **iOS native behavior**: Hidden.
- **Action**: `canShowUpgradeCTA()` gates rendering. Card does not render in native.

### 6. Results Dock Anonymous Soft Wall
- **File**: `frontend/components/results/results-dock.tsx:92-144`
- **Web behavior**: Shows "or Upgrade to Pro" link alongside "Create Free Account".
- **iOS native behavior**: "Upgrade to Pro" link hidden. "Create Free Account" remains. Copy adjusted.
- **Action**: `canShowUpgradeCTA()` hides the upgrade link. Account creation CTA preserved.

### 7. Results Dock Free-Tier Nudge
- **File**: `frontend/components/results/results-dock.tsx:250-258`
- **Web behavior**: Shows "Upgrade to Pro" button.
- **iOS native behavior**: Hidden.
- **Action**: `canShowUpgradeCTA()` gates rendering.

### 8. Upgrade Modal
- **File**: `frontend/components/upgrade/upgrade-modal.tsx`
- **Web behavior**: Full modal with pricing tiers and checkout buttons.
- **iOS native behavior**: Does not render.
- **Action**: Modal checks `canShowUpgradeCTA()` at render. Returns null when false.

### 9. Upgrade Page
- **File**: `frontend/app/upgrade/page.tsx`
- **Web behavior**: Full pricing page with plan comparison and checkout.
- **iOS native behavior**: Shows "manage on web" informational message instead of pricing.
- **Action**: Page checks `canShowUpgradeCTA()`. When false, renders message directing user to manage subscription at orangutany.com.

### 10. Billing Page Free-Tier CTA
- **File**: `frontend/app/account/billing/page.tsx:128-135`
- **Web behavior**: Shows "Upgrade to Pro" link for free users.
- **iOS native behavior**: Hidden.
- **Action**: `canShowUpgradeCTA()` gates rendering.

### 11. Billing Page Monthly→Lifetime CTA
- **File**: `frontend/app/account/billing/page.tsx:148-153`
- **Web behavior**: Shows "Upgrade to Lifetime" button for monthly subscribers.
- **iOS native behavior**: Hidden.
- **Action**: `canShowUpgradeCTA()` gates rendering.

## Allowed Surfaces

### 12. Billing Page Stripe Portal
- **File**: `frontend/app/account/billing/page.tsx:138-147,158-167`
- **Web behavior**: "Manage Subscription" and "View Receipts" buttons opening Stripe customer portal.
- **iOS native behavior**: ALLOWED. These are informational — they let users manage existing subscriptions, not initiate new purchases.
- **Action**: No suppression needed.

### 13. Home Page Success Banner
- **File**: `frontend/app/page.tsx:92-106`
- **Web behavior**: "Welcome to Pro!" banner shown after successful checkout redirect.
- **iOS native behavior**: ALLOWED. Post-purchase confirmation for a transaction completed on the web. Harmless.
- **Action**: No suppression needed.
