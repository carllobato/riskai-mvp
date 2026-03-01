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
  p50Cost: number;
  p80Cost: number;
  p90Cost: number;
  totalExpectedCost: number;
  p80Time: number | undefined;
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
 */
export function getNeutralSummary(state: AnalysisSelectorState): NeutralSummary | null {
  const snap = getNeutralSnapshot(state);
  if (!snap) return null;
  return {
    p50Cost: snap.p50Cost,
    p80Cost: snap.p80Cost,
    p90Cost: snap.p90Cost,
    totalExpectedCost: snap.totalExpectedCost,
    p80Time: Number.isFinite(snap.totalExpectedDays) ? snap.totalExpectedDays : undefined,
    lastRunAt: snap.timestampIso,
    riskCount: state.risks.length,
  };
}

/**
 * Raw cost samples from Monte Carlo neutral snapshot when available.
 */
export function getNeutralSamples(state: AnalysisSelectorState): number[] | null {
  return state.simulation.neutral?.costSamples ?? null;
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
