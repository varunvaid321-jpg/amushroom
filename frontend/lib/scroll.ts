const HEADER_HEIGHT = 64; // h-16 = 4rem = 64px

/** Scroll to an element by ID, offsetting for the sticky header. */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT;
  window.scrollTo({ top, behavior: "smooth" });
}
