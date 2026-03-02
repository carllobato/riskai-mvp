/**
 * Analysis page selectors — read-only views over simulation + risks.
 * Used by /analysis only; does not depend on Outputs page.
 */

import type {
  SimulationSnapshot,
  MonteCarloNeutralSnapshot,
} from "@/domain/simulation/simulation.types";
import type { Risk } from "@/domain/risk/risk.schema";
import type { ProjectionProfile } from "@/lib/projectionProfiles";
import { getEffectiveRiskInputs } from "@/domain/simulation/monteCarlo";
import { applyScenarioToRiskInputs } from "@/engine/scenario/applyScenarioToRiskInputs";

export type ScenarioSnapshotsMap = Partial<Record<ProjectionProfile, SimulationSnapshot>>;

export type AnalysisSelectorState = {
  risks: Risk[];
  simulation: {
    current?: SimulationSnapshot;
    history: SimulationSnapshot[];
    scenarioSnapshots?: ScenarioSnapshotsMap;
    neutral?: MonteCarloNeutralSnapshot;
  };
};

export type NeutralSummary = {
  p20Cost: number;
  p50Cost: number;
  p80Cost: number;
  p90Cost: number;
  totalExpectedCost: number;
  /** Schedule percentiles from neutral.summary (same source as tiles). */
  p20Time: number | undefined;
  p50Time: number | undefined;
  p80Time: number | undefined;
  p90Time: number | undefined;
  lastRunAt: string | undefined;
  riskCount: number;
};

/** Neutral snapshot: scenarioSnapshots.neutral ?? current (same as Outputs). */
function getNeutralSnapshot(state: AnalysisSelectorState): SimulationSnapshot | undefined {
  return state.simulation.scenarioSnapshots?.neutral ?? state.simulation.current;
}

/**
 * Summary from neutral snapshot for Analysis tiles.
 * Returns null when no neutral snapshot exists.
 * All schedule percentiles (p20Time, p50Time, p80Time, p90Time) come from neutral.summary (Monte Carlo combined distribution), not mean.
 */
export function getNeutralSummary(state: AnalysisSelectorState): NeutralSummary | null {
  const snap = getNeutralSnapshot(state);
  if (!snap) return null;
  const neutral = state.simulation.neutral;
  const summary = neutral?.summary;
  const p20Time = summary != null && Number.isFinite(summary.p20Time) ? summary.p20Time : undefined;
  const p50Time = summary != null && Number.isFinite(summary.p50Time) ? summary.p50Time : undefined;
  const p80Time =
    summary != null && Number.isFinite(summary.p80Time)
      ? summary.p80Time
      : Number.isFinite(snap.totalExpectedDays)
        ? snap.totalExpectedDays
        : undefined;
  const p90Time = summary != null && Number.isFinite(summary.p90Time) ? summary.p90Time : undefined;
  const includedCount = state.risks.filter((r) => r.status !== "closed").length;
  const p20Cost = (neutral?.summary != null && Number.isFinite(neutral.summary.p20Cost))
    ? neutral.summary.p20Cost
    : (snap as SimulationSnapshot & { p20Cost?: number }).p20Cost ?? snap.p50Cost;
  return {
    p20Cost,
    p50Cost: snap.p50Cost,
    p80Cost: snap.p80Cost,
    p90Cost: snap.p90Cost,
    totalExpectedCost: snap.totalExpectedCost,
    p20Time,
    p50Time,
    p80Time,
    p90Time,
    lastRunAt: snap.timestampIso,
    riskCount: includedCount,
  };
}

/**
 * Raw cost samples from Monte Carlo neutral snapshot when available.
 */
export function getNeutralSamples(state: AnalysisSelectorState): number[] | null {
  return state.simulation.neutral?.costSamples ?? null;
}

/**
 * Raw time (days) samples from Monte Carlo neutral snapshot when available.
 */
export function getNeutralTimeSamples(state: AnalysisSelectorState): number[] | null {
  return state.simulation.neutral?.timeSamples ?? null;
}

/**
 * Time percentiles from Monte Carlo neutral summary (for deriving time distribution when no raw samples).
 */
export type NeutralTimeSummary = {
  p20Time: number;
  p50Time: number;
  p80Time: number;
  p90Time: number;
};

export function getNeutralTimeSummary(state: AnalysisSelectorState): NeutralTimeSummary | null {
  const summary = state.simulation.neutral?.summary;
  if (!summary || !Number.isFinite(summary.p50Time) || !Number.isFinite(summary.p80Time) || !Number.isFinite(summary.p90Time)) {
    return null;
  }
  const p20Time = Number.isFinite(summary.p20Time) ? summary.p20Time : summary.p50Time;
  return {
    p20Time,
    p50Time: summary.p50Time,
    p80Time: summary.p80Time,
    p90Time: summary.p90Time,
  };
}

/**
 * Title of the risk with highest expected cost in the neutral snapshot.
 */
export function getTopRiskDriver(state: AnalysisSelectorState): string | null {
  const snap = getNeutralSnapshot(state);
  if (!snap?.risks?.length) return null;
  let maxCost = 0;
  let title: string | null = null;
  for (const r of snap.risks) {
    if (r.expectedCost > maxCost) {
      maxCost = r.expectedCost;
      title = r.title ?? null;
    }
  }
  return title;
}

export type TopMitigation = {
  name: string;
  roi: string;
  costBand: string;
  benefit: string;
};

/**
 * Top mitigation by ROI is provided by the mitigation-optimisation API, not the store.
 * Returns null; Analysis page can show "—" or call the API separately.
 */
export function getTopMitigation(_state: AnalysisSelectorState): TopMitigation | null {
  return null;
}

export type ModelStatus = "OK" | "NEEDS_RUN";

export type ModelStatusResult = {
  status: ModelStatus;
  reason: string;
};

export function getModelStatus(state: AnalysisSelectorState): ModelStatusResult {
  const neutral = getNeutralSnapshot(state);
  if (neutral) {
    return { status: "OK", reason: "Last run successful" };
  }
  if (state.risks.length === 0) {
    return { status: "NEEDS_RUN", reason: "Add risks and run simulation" };
  }
  return { status: "NEEDS_RUN", reason: "Run simulation to see results" };
}

/** Engine health key/value for Debug view. */
export function getEngineHealth(state: AnalysisSelectorState): Record<string, string> {
  const snap = getNeutralSnapshot(state);
  const scenarioSnapshots = state.simulation.scenarioSnapshots;
  const count = scenarioSnapshots ? Object.keys(scenarioSnapshots).length : 0;
  const neutral = state.simulation.neutral;
  return {
    lastRunAt: neutral != null ? String(neutral.lastRunAt) : (snap?.timestampIso ?? "—"),
    snapshotCount: String(count || (state.simulation.current ? 1 : 0)),
    hasNeutralSnapshot: snap ? "true" : "false",
    riskCount: String(state.risks.length),
    optimisationAPI: "unknown",
    iterationCount: neutral != null ? String(neutral.iterationCount) : "—",
    sampleCount: neutral != null ? String(neutral.costSamples.length) : "—",
    hasSamples: neutral != null && neutral.costSamples.length > 0 ? "true" : "false",
  };
}

/** First N included risks for audit panel (riskId, title, chosen inputs, source, units). */
export type AnalysisAuditRiskRow = {
  riskId: string;
  title: string;
  chosenProbability: number;
  chosenCostImpact: number;
  chosenTimeImpact: number;
  sourceUsed: "post" | "pre";
  units: string;
};

/** Developer-facing audit data for Math Audit panel (Debug). */
export type AnalysisAudit = {
  risksIncluded: number;
  risksExcludedClosed: number;
  usingPostMitigation: number;
  usingPreMitigation: number;
  first5: AnalysisAuditRiskRow[];
  costPercentiles: { p20: number; p50: number; p80: number; p90: number } | null;
  programmePercentiles: { p20: number; p50: number; p80: number; p90: number } | null;
};

/**
 * Builds audit data for the Analysis page Math Audit panel.
 * Uses same scenario (neutral) as simulation so inputs match what was run.
 */
export function getAnalysisAudit(state: AnalysisSelectorState): AnalysisAudit | null {
  const neutral = state.simulation.neutral;
  const neutralRisks = state.risks.map((r) => applyScenarioToRiskInputs(r, "neutral"));
  const effectiveList = neutralRisks
    .map((r) => ({ risk: r, inp: getEffectiveRiskInputs(r) }))
    .filter((x): x is { risk: Risk; inp: NonNullable<ReturnType<typeof getEffectiveRiskInputs>> } => x.inp != null);

  const closedCount = state.risks.filter((r) => r.status === "closed").length;
  const postCount = effectiveList.filter((x) => x.inp.sourceUsed === "post").length;
  const preCount = effectiveList.length - postCount;

  const first5: AnalysisAuditRiskRow[] = effectiveList.slice(0, 5).map(({ risk, inp }) => ({
    riskId: risk.id,
    title: risk.title ?? "",
    chosenProbability: inp.probability,
    chosenCostImpact: inp.costML,
    chosenTimeImpact: inp.timeML,
    sourceUsed: inp.sourceUsed,
    units: "cost: AUD, time: days",
  }));

  const costPercentiles =
    neutral?.summary != null
      ? {
          p20: neutral.summary.p20Cost,
          p50: neutral.summary.p50Cost,
          p80: neutral.summary.p80Cost,
          p90: neutral.summary.p90Cost,
        }
      : null;
  const programmePercentiles =
    neutral?.summary != null
      ? {
          p20: neutral.summary.p20Time,
          p50: neutral.summary.p50Time,
          p80: neutral.summary.p80Time,
          p90: neutral.summary.p90Time,
        }
      : null;

  return {
    risksIncluded: effectiveList.length,
    risksExcludedClosed: closedCount,
    usingPostMitigation: postCount,
    usingPreMitigation: preCount,
    first5,
    costPercentiles,
    programmePercentiles,
  };
}
