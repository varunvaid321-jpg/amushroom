"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Client component that highlights search terms in article text
 * and scrolls to the first highlighted match.
 *
 * Uses the browser's native CSS Custom Highlight API where available,
 * with a TreeWalker fallback that wraps matches in <mark> tags.
 */
export function ArticleHighlighter() {
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight");

  useEffect(() => {
    if (!highlight) return;

    const terms = highlight.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
    if (terms.length === 0) return;

    const article = document.querySelector("article");
    if (!article) return;

    // Find all text nodes in the article
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
    const matches: { node: Text; start: number; end: number }[] = [];

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const text = node.textContent?.toLowerCase() || "";
      for (const term of terms) {
        let pos = 0;
        while ((pos = text.indexOf(term, pos)) !== -1) {
          matches.push({ node, start: pos, end: pos + term.length });
          pos += term.length;
        }
      }
    }

    if (matches.length === 0) return;

    // Wrap matches in <mark> tags (process in reverse to preserve offsets)
    const marks: HTMLElement[] = [];
    // Group by node and sort by offset descending
    const byNode = new Map<Text, { start: number; end: number }[]>();
    for (const m of matches) {
      const existing = byNode.get(m.node) || [];
      existing.push(m);
      byNode.set(m.node, existing);
    }

    for (const [textNode, nodeMatches] of byNode) {
      // Sort descending so we can splice from the end
      nodeMatches.sort((a, b) => b.start - a.start);
      for (const { start, end } of nodeMatches) {
        const range = document.createRange();
        range.setStart(textNode, start);
        range.setEnd(textNode, end);
        const mark = document.createElement("mark");
        mark.className = "bg-primary/30 text-foreground font-semibold rounded-sm px-0.5";
        mark.dataset.searchHighlight = "true";
        range.surroundContents(mark);
        marks.push(mark);
      }
    }

    // Scroll to first match
    if (marks.length > 0) {
      setTimeout(() => {
        marks[0].scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }

    // Cleanup on unmount or query change
    return () => {
      for (const mark of marks) {
        const parent = mark.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
          parent.normalize();
        }
      }
    };
  }, [highlight]);

  return null;
}
