/**
 * Full-text search engine for learn articles.
 * Supports synonym expansion and context snippet extraction.
 */

interface ArticleData {
  slug: string;
  title: string;
  summary: string;
  category: string;
  sections: { heading: string; body: string[] }[];
}

export interface SearchResult {
  slug: string;
  title: string;
  summary: string;
  category: string;
  /** The matched snippet with the query term in context */
  snippet: string | null;
  /** Where the match was found */
  matchSource: "title" | "summary" | "category" | "body" | "heading" | "synonym";
  /** Relevance score (higher = better) */
  score: number;
}

// Synonym groups — any term in a group matches all others
const SYNONYM_GROUPS: string[][] = [
  ["deadly", "lethal", "fatal", "kill", "death", "die"],
  ["toxic", "poisonous", "poison", "toxin", "venomous", "harmful", "dangerous"],
  ["edible", "eat", "eating", "food", "cook", "cooking", "culinary", "delicious"],
  ["identify", "identification", "recognize", "recognise", "distinguish", "tell apart"],
  ["beginner", "beginner's", "start", "starting", "new", "first time", "learn"],
  ["safe", "safety", "caution", "careful", "risk", "warning"],
  ["forage", "foraging", "foraged", "forager", "wild", "hunt", "hunting", "pick", "picking", "harvest"],
  ["psychedelic", "psychoactive", "hallucinogenic", "psilocybin", "magic", "trip"],
  ["anatomy", "structure", "parts", "body", "cap", "gills", "stalk", "stem"],
  ["ecology", "ecosystem", "environment", "habitat", "forest", "wood", "tree"],
  ["season", "seasonal", "spring", "summer", "autumn", "fall", "winter", "calendar", "when"],
  ["mycorrhizal", "mycorrhiza", "network", "symbiosis", "symbiotic", "wood wide web"],
  ["spore", "spores", "spore print", "reproduce", "reproduction"],
  ["amanita", "destroying angel", "death cap", "galerina"],
];

function expandQuery(query: string): string[] {
  const q = query.toLowerCase();
  const terms = new Set<string>([q]);

  // Also add individual words for multi-word queries
  const words = q.split(/\s+/).filter((w) => w.length >= 3);
  for (const word of words) {
    terms.add(word);
  }

  // Expand each term through synonym groups
  const expanded = new Set<string>(terms);
  for (const term of terms) {
    for (const group of SYNONYM_GROUPS) {
      if (group.some((syn) => syn.includes(term) || term.includes(syn))) {
        for (const syn of group) {
          expanded.add(syn);
        }
      }
    }
  }

  return Array.from(expanded);
}

function extractSnippet(text: string, terms: string[], maxLen = 140): string | null {
  const lower = text.toLowerCase();

  // Find the first matching term's position
  let bestPos = -1;
  let bestTerm = "";
  for (const term of terms) {
    const pos = lower.indexOf(term);
    if (pos !== -1 && (bestPos === -1 || pos < bestPos)) {
      bestPos = pos;
      bestTerm = term;
    }
  }

  if (bestPos === -1) return null;

  // Find the sentence containing the match
  const sentences = text.split(/(?<=[.!?])\s+/);
  let charCount = 0;
  for (const sentence of sentences) {
    const sentEnd = charCount + sentence.length;
    if (bestPos >= charCount && bestPos < sentEnd) {
      // Found the sentence — truncate if too long
      if (sentence.length <= maxLen) return sentence;
      // Center the match in the snippet
      const matchInSentence = bestPos - charCount;
      const snippetStart = Math.max(0, matchInSentence - 50);
      const snippetEnd = Math.min(sentence.length, snippetStart + maxLen);
      let snippet = sentence.slice(snippetStart, snippetEnd);
      if (snippetStart > 0) snippet = "..." + snippet;
      if (snippetEnd < sentence.length) snippet = snippet + "...";
      return snippet;
    }
    charCount = sentEnd + 1; // +1 for the space after sentence
  }

  // Fallback: just take text around the match
  const start = Math.max(0, bestPos - 50);
  const end = Math.min(text.length, start + maxLen);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";
  return snippet;
}

export function searchArticles(articles: ArticleData[], query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const expandedTerms = expandQuery(q);
  // Direct terms = the original query + its words (not synonyms)
  const directTerms = [q, ...q.split(/\s+/).filter((w) => w.length >= 3)];
  const synonymOnly = expandedTerms.filter((t) => !directTerms.includes(t));

  const results: SearchResult[] = [];

  for (const article of articles) {
    let bestScore = 0;
    let bestSnippet: string | null = null;
    let bestSource: SearchResult["matchSource"] = "title";

    const titleLower = article.title.toLowerCase();
    const summaryLower = article.summary.toLowerCase();
    const categoryLower = article.category.toLowerCase();

    // Score: title match (highest priority)
    for (const term of expandedTerms) {
      if (titleLower.includes(term)) {
        const directMatch = directTerms.includes(term);
        const score = directMatch ? 100 : 60;
        if (score > bestScore) {
          bestScore = score;
          bestSource = directMatch ? "title" : "synonym";
          bestSnippet = null; // title match doesn't need snippet
        }
      }
    }

    // Score: summary match
    for (const term of expandedTerms) {
      if (summaryLower.includes(term)) {
        const directMatch = directTerms.includes(term);
        const score = directMatch ? 80 : 50;
        if (score > bestScore) {
          bestScore = score;
          bestSource = directMatch ? "summary" : "synonym";
          bestSnippet = extractSnippet(article.summary, [term]);
        }
      }
    }

    // Score: category match
    for (const term of expandedTerms) {
      if (categoryLower.includes(term)) {
        const directMatch = directTerms.includes(term);
        const score = directMatch ? 70 : 45;
        if (score > bestScore) {
          bestScore = score;
          bestSource = directMatch ? "category" : "synonym";
          bestSnippet = null;
        }
      }
    }

    // Score: section heading match
    for (const section of article.sections) {
      const headingLower = section.heading.toLowerCase();
      for (const term of expandedTerms) {
        if (headingLower.includes(term)) {
          const directMatch = directTerms.includes(term);
          const score = directMatch ? 75 : 48;
          if (score > bestScore) {
            bestScore = score;
            bestSource = directMatch ? "heading" : "synonym";
            bestSnippet = `Section: ${section.heading}`;
          }
        }
      }
    }

    // Score: body text match (deepest search)
    for (const section of article.sections) {
      for (const paragraph of section.body) {
        for (const term of expandedTerms) {
          if (paragraph.toLowerCase().includes(term)) {
            const directMatch = directTerms.includes(term);
            const score = directMatch ? 60 : 35;
            if (score > bestScore) {
              bestScore = score;
              bestSource = directMatch ? "body" : "synonym";
              bestSnippet = extractSnippet(paragraph, [term]);
            }
          }
        }
      }
    }

    if (bestScore > 0) {
      results.push({
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        category: article.category,
        snippet: bestSnippet,
        matchSource: bestSource,
        score: bestScore,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Highlight matching terms in text by wrapping them in <mark> tags.
 * Returns an array of {text, highlight} segments for React rendering.
 */
export function highlightTerms(
  text: string,
  query: string
): { text: string; highlight: boolean }[] {
  if (!query.trim()) return [{ text, highlight: false }];

  const terms = expandQuery(query.trim().toLowerCase());
  // Build regex from all terms, longest first to avoid partial matches
  const sorted = terms.filter((t) => t.length >= 3).sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return [{ text, highlight: false }];

  const escaped = sorted.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");

  const segments: { text: string; highlight: boolean }[] = [];
  let lastIndex = 0;

  text.replace(regex, (match, _group, offset) => {
    if (offset > lastIndex) {
      segments.push({ text: text.slice(lastIndex, offset), highlight: false });
    }
    segments.push({ text: match, highlight: true });
    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), highlight: false });
  }

  return segments.length > 0 ? segments : [{ text, highlight: false }];
}
