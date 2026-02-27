/**
 * Day 6 – Portfolio decision summary selectors (rollups).
 * No UI; no topMovers (no snapshot-to-snapshot decision history selector exists).
 */

import type { DecisionSelectorState } from "./decision.selectors";
import { selectRankedRisks, selectDecisionByRiskId } from "./decision.selectors";

export type ScoreDistribution = {
  "0_20": number;
  "20_40": number;
  "40_60": number;
  "60_80": number;
  "80_100": number;
};

export type PortfolioDecisionSummary = {
  totalRisks: number;
  criticalCount: number;
  acceleratingCount: number;
  volatileCount: number;
  unstableCount: number;
  emergingCount: number;
  improvingCount: number;
  avgCompositeScore: number;
  scoreDistribution: ScoreDistribution;
};

function bucket(score: number): keyof ScoreDistribution {
  const s = Number.isFinite(score) ? score : 0;
  if (s < 20) return "0_20";
  if (s < 40) return "20_40";
  if (s < 60) return "40_60";
  if (s < 80) return "60_80";
  return "80_100";
}

function safeScore(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/**
 * Returns portfolio-level rollups: tag counts, average composite score, score distribution.
 * Safe when there are 0 risks or missing decisionById entries.
 */
export function selectPortfolioDecisionSummary(
  state: DecisionSelectorState
): PortfolioDecisionSummary {
  const ranked = selectRankedRisks(state);
  const decisionById = selectDecisionByRiskId(state);

  const totalRisks = ranked.length;

  let criticalCount = 0;
  let acceleratingCount = 0;
  let volatileCount = 0;
  let unstableCount = 0;
  let emergingCount = 0;
  let improvingCount = 0;

  const scoreDistribution: ScoreDistribution = {
    "0_20": 0,
    "20_40": 0,
    "40_60": 0,
    "60_80": 0,
    "80_100": 0,
  };

  let sumScore = 0;
  for (const row of ranked) {
    const sc = safeScore(row.compositeScore);
    sumScore += sc;
    scoreDistribution[bucket(sc)]++;

    const tags = decisionById[row.riskId]?.alertTags ?? [];
    for (const t of tags) {
      if (t === "CRITICAL") criticalCount++;
      else if (t === "ACCELERATING") acceleratingCount++;
      else if (t === "VOLATILE") volatileCount++;
      else if (t === "UNSTABLE") unstableCount++;
      else if (t === "EMERGING") emergingCount++;
      else if (t === "IMPROVING") improvingCount++;
    }
  }

  const avgCompositeScore =
    totalRisks === 0 ? 0 : (Number.isFinite(sumScore) ? Math.round((sumScore / totalRisks) * 10) / 10 : 0);

  return {
    totalRisks,
    criticalCount,
    acceleratingCount,
    volatileCount,
    unstableCount,
    emergingCount,
    improvingCount,
    avgCompositeScore,
    scoreDistribution,
  };
}
