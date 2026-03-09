export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function ensureSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : trimmed + ".";
}

export function formatNaturalList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function firstSentence(text: string, maxChars = 240): string {
  if (!text) return "";
  const match = text.match(/^[^.!?]*[.!?]/);
  const sentence = match ? match[0] : text;
  return sentence.length > maxChars ? sentence.slice(0, maxChars) + "..." : sentence;
}

export function excerptSentences(
  text: string,
  maxSentences = 3,
  maxChars = 500,
): string {
  if (!text) return "";
  const sentences = text.match(/[^.!?]*[.!?]/g) || [text];
  let result = "";
  for (let i = 0; i < Math.min(sentences.length, maxSentences); i++) {
    if (result.length + sentences[i].length > maxChars) break;
    result += sentences[i];
  }
  return result.trim() || firstSentence(text, maxChars);
}

export function chipVariant(
  label: string,
): "destructive" | "default" | "secondary" | "outline" {
  const l = label.toLowerCase();
  if (l.includes("poisonous") || l.includes("toxic") || l.includes("deadly"))
    return "destructive";
  if (l.includes("edible") || l === "yes") return "default";
  if (l === "no" || l.includes("unknown")) return "secondary";
  return "outline";
}

export function confidenceColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

export function buildConfidenceGuidance(
  score: number,
  missingRoles: string[],
): string {
  let msg = "";
  if (score >= 80) {
    msg = "High confidence match. The AI is quite certain about this identification.";
  } else if (score >= 60) {
    msg =
      "Moderate confidence. Consider uploading additional angles for a stronger match.";
  } else if (score >= 40) {
    msg =
      "Low-moderate confidence. More photos from different angles would help improve accuracy.";
  } else {
    msg =
      "Low confidence. The identification is uncertain — additional photos are strongly recommended.";
  }
  if (missingRoles.length > 0) {
    msg += ` Try adding: ${formatNaturalList(missingRoles)}.`;
  }
  return msg;
}

export function buildReferenceProfileSummary(match: {
  commonName: string;
  scientificName: string;
  description: string;
}): string {
  if (match.description) return firstSentence(match.description);
  return `${match.commonName} (${match.scientificName}) is a species of fungus.`;
}

export function friendlyConsistencyMessage(
  check: { likelyMixed: boolean; message: string } | null,
): string {
  if (!check) return "";
  if (check.likelyMixed) {
    return "The photos may contain more than one species. Consider scanning each mushroom separately for best results.";
  }
  return "Photos appear consistent — they likely show the same species.";
}
