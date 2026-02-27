/**
 * Day 6 – Deterministic ranking for risks (pure function).
 * Tie-breakers (in order): compositeScore desc → triggerRate desc → velocity desc → volatility desc →
 * stabilityScore asc (lower = worse) → title asc → riskId asc (final tie-breaker for stable ordering).
 */

export type RiskSummaryForRank = {
  riskId: string;
  title?: string;
  triggerRate?: number;
  velocity?: number;
  volatility?: number;
  stabilityScore?: number;
  compositeScore: number;
};

const SAFE_NUM = (n: number | undefined, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? n : fallback;

/**
 * Sorts risk summaries by criticality (desc) with deterministic tie-breakers,
 * then assigns rank 1, 2, 3, ...
 * Missing numeric values treated as 0; missing stabilityScore treated as 100 (stable).
 */
export function rankRisks(params: {
  riskSummaries: RiskSummaryForRank[];
}): Array<{ riskId: string; rank: number }> {
  const { riskSummaries } = params;
  if (riskSummaries.length === 0) return [];

  const sorted = [...riskSummaries].sort((a, b) => {
    const aScore = SAFE_NUM(a.compositeScore, 0);
    const bScore = SAFE_NUM(b.compositeScore, 0);
    if (bScore !== aScore) return bScore - aScore;

    const aTrigger = SAFE_NUM(a.triggerRate, 0);
    const bTrigger = SAFE_NUM(b.triggerRate, 0);
    if (bTrigger !== aTrigger) return bTrigger - aTrigger;

    const aVel = SAFE_NUM(a.velocity, 0);
    const bVel = SAFE_NUM(b.velocity, 0);
    if (bVel !== aVel) return bVel - aVel;

    const aVol = SAFE_NUM(a.volatility, 0);
    const bVol = SAFE_NUM(b.volatility, 0);
    if (bVol !== aVol) return bVol - aVol;

    const aStab = SAFE_NUM(a.stabilityScore, 100);
    const bStab = SAFE_NUM(b.stabilityScore, 100);
    if (aStab !== bStab) return aStab - bStab;

    const aTitle = (a.title ?? "").localeCompare(b.title ?? "", undefined, { sensitivity: "base" });
    if (aTitle !== 0) return aTitle;

    return (a.riskId ?? "").localeCompare(b.riskId ?? "", undefined, { sensitivity: "base" });
  });

  return sorted.map((r, i) => ({ riskId: r.riskId, rank: i + 1 }));
}
