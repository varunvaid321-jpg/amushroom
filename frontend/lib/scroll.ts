const HEADER_HEIGHT = 72; // h-16 (64px) + 8px buffer

/**
 * Scroll to an element by ID, offsetting for the sticky header.
 * Uses scrollIntoView with scroll-margin-top where supported,
 * with manual fallback for browsers that ignore scroll-margin-top.
 */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;

  // Try native scrollIntoView (works when scroll-margin-top is set in CSS)
  if (CSS.supports("scroll-margin-top", "1px")) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    // Manual fallback
    const top = el.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT;
    window.scrollTo({ top, behavior: "smooth" });
  }

  // Safety check: after scroll completes, verify position and correct if needed
  setTimeout(() => {
    const rect = el.getBoundingClientRect();
    if (rect.top < HEADER_HEIGHT - 4) {
      // Element is hidden behind header — nudge down
      window.scrollBy({ top: rect.top - HEADER_HEIGHT, behavior: "smooth" });
    }
  }, 600);
}
