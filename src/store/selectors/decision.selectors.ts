/**
 * Day 6 decision selectors — composite score, rank, and alert tags per riskId from Day 5 intelligence.
 * Pure functions: output depends only on state.simulation. Callers should useMemo with [state.simulation]
 * to avoid recomputing when simulation is unchanged.
 */

import type { SimulationSnapshot } from "@/domain/simulation/simulation.types";
import type { DecisionMetrics } from "@/domain/decision/decision.types";
import { computeCompositeScore } from "@/domain/decision/decision.score";
import { rankRisks } from "@/domain/decision/decision.rank";
import { deriveAlertTags } from "@/domain/decision/decision.alerts";
import { DEFAULT_DECISION_THRESHOLDS } from "@/config/decisionDefaults";
import { selectLatestSnapshotRiskIntelligence } from "@/lib/simulationSelectors";

/** Minimal state slice needed for decision selectors (matches risk-register store). */
export type DecisionSelectorState = {
  simulation: {
    current?: SimulationSnapshot;
    history: SimulationSnapshot[];
  };
};

/**
 * Build a map of riskId → intelligence metrics (triggerRate, velocity, volatility, stabilityScore)
 * from the Day 5 selector that returns an array.
 */
function getIntelligenceByRiskId(state: DecisionSelectorState): Map<string, {
  triggerRate?: number;
  velocity?: number;
  volatility?: number;
  stabilityScore?: number;
}> {
  const { current, history } = state.simulation ?? {};
  const rows = selectLatestSnapshotRiskIntelligence(current, history);
  const map = new Map<string, {
    triggerRate?: number;
    velocity?: number;
    volatility?: number;
    stabilityScore?: number;
  }>();
  for (const row of rows) {
    map.set(row.id, {
      triggerRate: row.triggerRate,
      velocity: row.velocity,
      volatility: row.volatility,
      stabilityScore: row.stability,
    });
  }
  return map;
}

/**
 * Returns decision metrics (compositeScore, rank, alertTags: []) per riskId.
 * Rank from rankRisks(); alertTags populated in Step 3.
 */
export function selectDecisionByRiskId(state: DecisionSelectorState): Record<string, DecisionMetrics> {
  const { current, history } = state.simulation ?? {};
  const rows = selectLatestSnapshotRiskIntelligence(current, history);

  const riskSummaries = rows.map((row) => {
    const metrics = {
      triggerRate: row.triggerRate,
      velocity: row.velocity,
      volatility: row.volatility,
      stabilityScore: row.stability,
    };
    const { score } = computeCompositeScore(metrics);
    return {
      riskId: row.id,
      title: row.title,
      triggerRate: row.triggerRate,
      velocity: row.velocity,
      volatility: row.volatility,
      stabilityScore: row.stability,
      compositeScore: score,
    };
  });

  const rankResults = rankRisks({ riskSummaries });
  const rankMap = new Map(rankResults.map((r) => [r.riskId, r.rank]));

  const out: Record<string, DecisionMetrics> = {};
  for (const sum of riskSummaries) {
    const alertTags = deriveAlertTags(
      {
        riskId: sum.riskId,
        compositeScore: sum.compositeScore,
        triggerRate: sum.triggerRate,
        velocity: sum.velocity,
        volatility: sum.volatility,
        stabilityScore: sum.stabilityScore,
      },
      DEFAULT_DECISION_THRESHOLDS
    );
    out[sum.riskId] = {
      compositeScore: sum.compositeScore,
      rank: rankMap.get(sum.riskId) ?? 0,
      alertTags,
    };
  }

  return out;
}

/** Row shape for ranked / top-critical lists. */
export type RankedRiskRow = {
  riskId: string;
  title: string;
  compositeScore: number;
  rank: number;
};

/**
 * Returns risks sorted by rank (most critical first), with riskId, title, compositeScore, rank.
 * Uses Day 5 intelligence rows for riskId + title; decision map for score and rank.
 */
export function selectRankedRisks(state: DecisionSelectorState): RankedRiskRow[] {
  const { current, history } = state.simulation ?? {};
  const rows = selectLatestSnapshotRiskIntelligence(current, history);
  const decisionMap = selectDecisionByRiskId(state);

  const merged: RankedRiskRow[] = rows.map((row) => ({
    riskId: row.id,
    title: row.title ?? "",
    compositeScore: decisionMap[row.id]?.compositeScore ?? 0,
    rank: decisionMap[row.id]?.rank ?? 0,
  }));

  return merged.sort((a, b) => a.rank - b.rank);
}

/**
 * Returns the top N risks by rank (most critical first).
 */
export function selectTopCriticalRisks(limit = 10) {
  return function (state: DecisionSelectorState): RankedRiskRow[] {
    return selectRankedRisks(state).slice(0, limit);
  };
}

/**
 * Returns ranked risks that have at least one alert tag.
 */
export function selectFlaggedRisks(state: DecisionSelectorState): RankedRiskRow[] {
  const ranked = selectRankedRisks(state);
  const decisionMap = selectDecisionByRiskId(state);
  return ranked.filter((row) => (decisionMap[row.riskId]?.alertTags?.length ?? 0) > 0);
}

/**
 * Returns ranked risks that have the CRITICAL alert tag.
 */
export function selectCriticalRisks(state: DecisionSelectorState): RankedRiskRow[] {
  const ranked = selectRankedRisks(state);
  const decisionMap = selectDecisionByRiskId(state);
  return ranked.filter((row) => decisionMap[row.riskId]?.alertTags?.includes("CRITICAL") ?? false);
}

/**
 * Returns decision metrics for a single risk, or null if not found.
 */
export function selectDecisionForRisk(riskId: string) {
  return function (state: DecisionSelectorState): DecisionMetrics | null {
    const map = selectDecisionByRiskId(state);
    return map[riskId] ?? null;
  };
}

const SCORE_DELTA_THRESHOLD = 3;

/**
 * Returns per-risk composite score delta (current - previous snapshot).
 * Previous snapshot = state.simulation.history[1]. Empty when history has fewer than 2 snapshots.
 */
export function selectDecisionScoreDelta(state: DecisionSelectorState): Record<string, number> {
  const { history = [] } = state.simulation ?? {};
  if (history.length < 2) return {};
  const currentMap = selectDecisionByRiskId(state);
  const previousState: DecisionSelectorState = {
    simulation: { current: history[1], history: history.slice(1) },
  };
  const previousMap = selectDecisionByRiskId(previousState);
  const out: Record<string, number> = {};
  for (const riskId of Object.keys(currentMap)) {
    const curr = currentMap[riskId]?.compositeScore ?? 0;
    const prev = previousMap[riskId]?.compositeScore ?? 0;
    out[riskId] = curr - prev;
  }
  return out;
}

/** Delta threshold for showing ↑ / ↓ (show only when |delta| > this). */
export const SCORE_DELTA_SHOW_THRESHOLD = SCORE_DELTA_THRESHOLD;
