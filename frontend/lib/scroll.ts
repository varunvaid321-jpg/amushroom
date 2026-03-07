/** Scroll to an element by ID. Elements must have scroll-margin-top set via CSS. */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}
