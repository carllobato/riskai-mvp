import type {
  SimulationRiskSnapshot,
  SimulationSnapshot,
} from "@/domain/simulation/simulation.types";

const DEFAULT_EPS = 1e-9;
const DEFAULT_EPS_VOLATILITY = 1e-6;
const DEFAULT_N = 5;

/** Per-risk intelligence metrics computed from snapshot history (BOH-only). */
export type RiskIntelligenceMetrics = {
  velocity: number;
  volatility: number;
  stability: number;
};

export type RiskIntelligenceOptions = {
  /** Number of snapshots to use for velocity slope (default 5). */
  N?: number;
  /** Guard for divide-by-zero in volatility (default 1e-9). */
  eps?: number;
};

/**
 * Selector: from snapshot history, compute per-risk velocity, volatility, and stability.
 * - velocity: slope of simMeanCost over the last N snapshots (positive = increasing).
 * - volatility: latest simStdDev / max(latest simMeanCost, eps).
 * - stability: 0–100 score (simple v1) from |velocity| and volatility; higher = more stable.
 * Handles missing history and missing risk-in-snapshot gracefully.
 */
export function selectRiskIntelligenceMetrics(
  history: SimulationSnapshot[],
  options: RiskIntelligenceOptions = {}
): Map<string, RiskIntelligenceMetrics> {
  const N = options.N ?? DEFAULT_N;
  const eps = options.eps ?? DEFAULT_EPS;
  const result = new Map<string, RiskIntelligenceMetrics>();

  if (history.length === 0) return result;

  const lastN = history.slice(0, N);
  const latest = lastN[0];
  if (!latest?.risks?.length) return result;

  for (const risk of latest.risks) {
    const riskId = risk.id;
    const means: number[] = [];
    for (const snap of lastN) {
      const r = snap.risks?.find((x) => x.id === riskId);
      if (r != null) means.push(r.simMeanCost);
    }

    const velocity =
      means.length >= 2
        ? (means[0] - means[means.length - 1]) / (means.length - 1)
        : 0;

    const latestMean = risk.simMeanCost;
    const latestStdDev = risk.simStdDev ?? 0;
    const denom = Math.max(Math.abs(latestMean), DEFAULT_EPS_VOLATILITY);
    const volatility = latestStdDev / denom;
    const velocityAbs = Math.abs(velocity) / denom;
    const velocityScore = Math.min(velocityAbs, 1);
    const volatilityScore = Math.min(volatility / 5, 1);
    const stabilityRaw = 1 - (0.5 * velocityScore + 0.5 * volatilityScore);
    const stability = Math.max(0, Math.min(100, stabilityRaw * 100));

    result.set(riskId, { velocity, volatility, stability });
  }

  return result;
}

/** Per-risk row for Intelligence table: latest snapshot fields + computed velocity, volatility, stability (always numbers). */
export type LatestSnapshotRiskIntelligenceRow = {
  id: string;
  title: string;
  category?: string;
  expectedCost: number;
  expectedDays: number;
  simMeanCost: number;
  simMeanDays: number;
  simStdDev: number;
  triggerRate: number;
  velocity: number;
  volatility: number;
  stability: number;
};

/**
 * Selector: from latest snapshot and history, return risks with existing fields plus
 * computed velocity, volatility, stability. Uses risk id for matching across snapshots.
 * - volatility = simStdDev / max(|simMean|, eps); 0 if simStdDev missing. Displays after 1 run.
 * - velocity = slope of simMean over last N snapshots; 0 if &lt; 2 snapshots or risk not in enough. Displays after 2 runs.
 * - stability = 0–100 from |velocity| + volatility (simple v1); 0 when inputs missing.
 */
export function selectLatestSnapshotRiskIntelligence(
  current: SimulationSnapshot | undefined,
  history: SimulationSnapshot[],
  options: RiskIntelligenceOptions & { epsVolatility?: number } = {}
): LatestSnapshotRiskIntelligenceRow[] {
  if (!current?.risks?.length) return [];

  const N = options.N ?? DEFAULT_N;
  const eps = options.epsVolatility ?? DEFAULT_EPS_VOLATILITY;
  const lastN = history.slice(0, N);

  return current.risks.map((risk) => {
    const riskId = risk.id;
    const simMean = risk.simMeanCost;
    const simStdDevRaw = risk.simStdDev ?? 0;
    const denom = Math.max(Math.abs(simMean), eps);
    const volatility = Number.isFinite(simStdDevRaw) ? simStdDevRaw / denom : 0;

    const means: number[] = [];
    for (const snap of lastN) {
      const r = snap.risks?.find((x) => x.id === riskId);
      if (r != null && Number.isFinite(r.simMeanCost)) means.push(r.simMeanCost);
    }
    const velocity =
      means.length >= 2
        ? (means[0] - means[means.length - 1]) / (means.length - 1)
        : 0;

    const velocityAbs = Math.abs(velocity) / denom;
    const velocityScore = Math.min(velocityAbs, 1);
    const volatilityScore = Math.min(volatility / 5, 1);
    const stabilityRaw = 1 - (0.5 * velocityScore + 0.5 * volatilityScore);
    const stability = Math.max(0, Math.min(100, stabilityRaw * 100));

    const triggerRate = risk.triggerRate ?? 0;

    return {
      id: risk.id,
      title: risk.title,
      category: risk.category,
      expectedCost: risk.expectedCost,
      expectedDays: risk.expectedDays,
      simMeanCost: risk.simMeanCost,
      simMeanDays: risk.simMeanDays,
      simStdDev: risk.simStdDev ?? 0,
      triggerRate,
      velocity,
      volatility,
      stability,
    };
  });
}

/**
 * Returns a new snapshot with per-risk velocity/volatility/stability (and optional
 * portfolio root) merged from metrics computed over history. Does not mutate the
 * input snapshot or history. Call with history that already has this snapshot at index 0.
 */
export function enrichSnapshotWithIntelligenceMetrics(
  snapshot: SimulationSnapshot,
  history: SimulationSnapshot[],
  options: RiskIntelligenceOptions = {}
): SimulationSnapshot {
  const metrics = selectRiskIntelligenceMetrics(history, options);
  if (metrics.size === 0) return snapshot;

  const risks: SimulationRiskSnapshot[] = snapshot.risks.map((r) => {
    const m = metrics.get(r.id);
    if (!m) return r;
    return { ...r, velocity: m.velocity, volatility: m.volatility, stability: m.stability };
  });

  const portfolioVelocity =
    risks.reduce((s, r) => s + (r.velocity ?? 0), 0) / risks.length;
  const portfolioVolatility =
    risks.reduce((s, r) => s + (r.volatility ?? 0), 0) / risks.length;
  const portfolioStability =
    risks.reduce((s, r) => s + (r.stability ?? 0), 0) / risks.length;

  return {
    ...snapshot,
    risks,
    velocity: portfolioVelocity,
    volatility: portfolioVolatility,
    stability: portfolioStability,
  };
}

const DEBUG_RISK_INTELLIGENCE = false;

/**
 * Dev-only: log per-risk intelligence metrics for the given history.
 * No-op when DEBUG_RISK_INTELLIGENCE is false.
 */
export function dumpRiskIntelligenceMetrics(
  _history: SimulationSnapshot[],
  _options?: RiskIntelligenceOptions
): void {
  if (!DEBUG_RISK_INTELLIGENCE) return;
  // Dev-only: metrics available via selectRiskIntelligenceMetrics; no console output in production.
}
