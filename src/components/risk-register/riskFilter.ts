import type { Risk } from "@/domain/risk/risk.schema";

const RATING_ALIASES: Record<string, string> = {
  high: "h",
  medium: "m",
  low: "l",
  extreme: "e",
  h: "high",
  m: "medium",
  l: "low",
  e: "extreme",
};

const LEVEL_LETTERS: Record<string, string> = {
  low: "l",
  medium: "m",
  high: "h",
  extreme: "e",
};

/** Concatenate all searchable fields for a risk (for filter across columns). */
export function riskToSearchText(risk: Risk): string {
  const id = risk.riskNumber != null ? String(risk.riskNumber).padStart(3, "0") : risk.id;
  const pre = risk.inherentRating?.level ?? "";
  const post = risk.residualRating?.level ?? "";
  const movement =
    risk.inherentRating != null && risk.residualRating != null
      ? (risk.residualRating.score - risk.inherentRating.score) > 0
        ? "up worsening"
        : (risk.residualRating.score - risk.inherentRating.score) < 0
          ? "down improving"
          : "stable"
      : "";
  return [
    id,
    risk.title ?? "",
    risk.description ?? "",
    risk.category ?? "",
    risk.owner ?? "",
    pre,
    post,
    LEVEL_LETTERS[pre] ?? pre,
    LEVEL_LETTERS[post] ?? post,
    RATING_ALIASES[pre] ?? pre,
    RATING_ALIASES[post] ?? post,
    movement,
    risk.status ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

/** Case-insensitive match; rating aliases (H/M/L, High/Medium/Low) are in riskToSearchText. */
export function matchesFilter(risk: Risk, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const text = riskToSearchText(risk);
  const terms = q.split(/\s+/).filter(Boolean);
  return terms.every((term) => text.includes(term));
}
