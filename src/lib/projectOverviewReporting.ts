/**
 * Executive overview metrics from the reporting simulation + risk register.
 * Reuses the same driver and CDF construction patterns as Run Data / Simulation (no duplicated engine math).
 */

import type { SimulationSnapshotRow } from "@/lib/db/snapshots";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatDurationDays } from "@/lib/formatDuration";
import type { SimulationSnapshot } from "@/domain/simulation/simulation.types";
import type { MonteCarloNeutralSnapshot } from "@/domain/simulation/simulation.types";
import type { Risk } from "@/domain/risk/risk.schema";
import { computePortfolioExposure } from "@/engine/forwardExposure";
import type { PortfolioExposure } from "@/engine/forwardExposure";
import { appliesToExcludesCost } from "@/domain/risk/riskFieldSemantics";
import {
  binSamplesIntoHistogram,
  binSamplesIntoTimeHistogram,
  costAtPercentile,
  deriveCostHistogramFromPercentiles,
  deriveTimeHistogramFromPercentiles,
  distributionToCostCdf,
  distributionToTimeCdf,
  timeAtPercentile,
  type CostCdfPoint,
  type TimeCdfPoint,
} from "@/lib/simulationDisplayUtils";

const DISTRIBUTION_BIN_COUNT = 28;

const REPORTING_ANCHOR_PERCS = [20, 50, 80, 90] as const;
export type ReportingAnchorPercentile = (typeof REPORTING_ANCHOR_PERCS)[number];

function finiteOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Closest of P20/P50/P80/P90 to the configured risk appetite (0–100). */
export function nearestReportingAnchorPercentile(targetPercent: number): ReportingAnchorPercentile {
  const t = Math.min(100, Math.max(0, targetPercent));
  let best: ReportingAnchorPercentile = 80;
  let bestDist = Infinity;
  for (const a of REPORTING_ANCHOR_PERCS) {
    const d = Math.abs(a - t);
    if (d < bestDist) {
      bestDist = d;
      best = a;
    }
  }
  return best;
}

export function snapshotCostAtAnchor(
  row: SimulationSnapshotRow,
  anchor: ReportingAnchorPercentile
): number | null {
  switch (anchor) {
    case 20:
      return finiteOrNull(row?.cost_p20);
    case 50:
      return finiteOrNull(row?.cost_p50);
    case 80:
      return finiteOrNull(row?.cost_p80);
    case 90:
      return finiteOrNull(row?.cost_p90);
    default:
      return null;
  }
}

export function snapshotTimeAtAnchor(
  row: SimulationSnapshotRow,
  anchor: ReportingAnchorPercentile
): number | null {
  switch (anchor) {
    case 20:
      return finiteOrNull(row?.time_p20);
    case 50:
      return finiteOrNull(row?.time_p50);
    case 80:
      return finiteOrNull(row?.time_p80);
    case 90:
      return finiteOrNull(row?.time_p90);
    default:
      return null;
  }
}

type PercValuePoint = { p: number; v: number };

function buildSortedPercValuePoints(
  row: SimulationSnapshotRow,
  kind: "cost" | "time"
): PercValuePoint[] {
  const pts: PercValuePoint[] = [];
  for (const a of REPORTING_ANCHOR_PERCS) {
    const v = kind === "cost" ? snapshotCostAtAnchor(row, a) : snapshotTimeAtAnchor(row, a);
    if (v != null) pts.push({ p: a, v });
  }
  pts.sort((x, y) => x.p - y.p);
  return pts;
}

/**
 * Piecewise-linear value at a cumulative percentile using snapshot P20/P50/P80/P90 only.
 * Outside [min anchor, max anchor] returns the nearest endpoint.
 */
export function interpolateSnapshotAtRiskPercentile(
  row: SimulationSnapshotRow,
  targetPercent: number,
  kind: "cost" | "time"
): number | null {
  const pts = buildSortedPercValuePoints(row, kind);
  if (pts.length === 0) return null;
  const t = Math.min(100, Math.max(0, targetPercent));
  if (t <= pts[0].p) return pts[0].v;
  if (t >= pts[pts.length - 1].p) return pts[pts.length - 1].v;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (t >= a.p && t <= b.p) {
      const u = (t - a.p) / (b.p - a.p);
      return a.v + (b.v - a.v) * u;
    }
  }
  return null;
}

const SNAPSHOT_COST_BUFFER_KEYS = [
  "available_exposure",
  "availableExposure",
  "contingency_remaining",
  "cost_contingency_remaining",
  "remaining_contingency",
  "cost_buffer_remaining",
] as const;

const SNAPSHOT_TIME_BUFFER_KEYS = [
  "time_contingency_remaining",
  "schedule_buffer_remaining",
  "remaining_schedule_contingency",
] as const;

function firstFiniteFromRecord(
  rec: Record<string, unknown> | null | undefined,
  keys: readonly string[]
): number | null {
  if (!rec) return null;
  for (const k of keys) {
    const n = finiteOrNull(rec[k]);
    if (n != null && n >= 0) return n;
  }
  return null;
}

/** Optional buffer scalars if ever persisted on snapshot payload (otherwise null). */
export function optionalBufferFromSnapshotPayload(row: SimulationSnapshotRow): {
  costDollars: number | null;
  timeDays: number | null;
} {
  const pl = row?.payload;
  const summary =
    pl?.summary && typeof pl.summary === "object"
      ? (pl.summary as Record<string, unknown>)
      : null;
  const summaryReport =
    pl?.summaryReport && typeof pl.summaryReport === "object"
      ? (pl.summaryReport as Record<string, unknown>)
      : null;
  const costDollars =
    firstFiniteFromRecord(summary, SNAPSHOT_COST_BUFFER_KEYS) ??
    firstFiniteFromRecord(summaryReport, SNAPSHOT_COST_BUFFER_KEYS);
  const timeDays =
    firstFiniteFromRecord(summary, SNAPSHOT_TIME_BUFFER_KEYS) ??
    firstFiniteFromRecord(summaryReport, SNAPSHOT_TIME_BUFFER_KEYS);
  return { costDollars, timeDays };
}

function topRiskTitleByField(
  row: SimulationSnapshotRow,
  scoreField: "simMeanCost" | "simMeanDays"
): string | null {
  const risks = row?.payload?.risks;
  if (!Array.isArray(risks) || risks.length === 0) return null;
  let bestTitle: string | null = null;
  let bestScore = -Infinity;
  for (const r of risks) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const score = finiteOrNull(o[scoreField]);
    if (score == null || score <= 0) continue;
    if (score > bestScore) {
      bestScore = score;
      const title = typeof o.title === "string" ? o.title.trim() : "";
      bestTitle = title.length > 0 ? title : String(o.id ?? "");
    }
  }
  return bestTitle;
}

/** Largest simMeanCost risk title from locked snapshot payload (read-only). */
export function topCostRiskTitleFromSnapshotPayload(row: SimulationSnapshotRow): string | null {
  return topRiskTitleByField(row, "simMeanCost");
}

/** Largest simMeanDays risk title from locked snapshot payload (read-only). */
export function topTimeRiskTitleFromSnapshotPayload(row: SimulationSnapshotRow): string | null {
  return topRiskTitleByField(row, "simMeanDays");
}

/** Mean vs piecewise appetite-line cost from snapshot columns (no live simulation). */
export function formatModelledCostGapMeanVsAppetiteLine(
  meanCost: number | null,
  appetiteLineCost: number | null
): string {
  if (meanCost == null || appetiteLineCost == null) return "—";
  if (!Number.isFinite(meanCost) || !Number.isFinite(appetiteLineCost)) return "—";
  const d = meanCost - appetiteLineCost;
  const mag = formatCurrency(Math.abs(d));
  if (d === 0) return "Mean aligned with appetite-line modeled cost";
  if (d > 0) return `${mag} above appetite-line modeled cost (mean)`;
  return `${mag} below appetite-line modeled cost (mean)`;
}

export function formatModelledTimeGapMeanVsAppetiteLine(
  meanDays: number | null,
  appetiteLineDays: number | null
): string {
  if (meanDays == null || appetiteLineDays == null) return "—";
  if (!Number.isFinite(meanDays) || !Number.isFinite(appetiteLineDays)) return "—";
  const d = meanDays - appetiteLineDays;
  const mag = formatDurationDays(Math.abs(d));
  if (d === 0) return "Mean aligned with appetite-line modeled time";
  if (d > 0) return `${mag} above appetite-line modeled time (mean)`;
  return `${mag} below appetite-line modeled time (mean)`;
}

export function computeNeutralForwardExposure(risks: Risk[]): PortfolioExposure {
  const topN = Math.min(500, Math.max(1, risks.length));
  return computePortfolioExposure(risks, "neutral", 12, { topN, includeDebug: false });
}

export type CostDriverLine = { riskId: string; riskName: string; delta: number };
export type ScheduleDriverLine = {
  riskId: string;
  riskName: string;
  totalDays: number;
  delta: number;
};

/** Cost drivers aligned with Run Data (neutral exposure, run snapshot risk set, cost-applicable risks). */
export function buildCostDriverLines(
  current: SimulationSnapshot | undefined,
  risks: Risk[],
  neutralExposure: PortfolioExposure
): CostDriverLine[] {
  const runRiskIds = new Set((current?.risks ?? []).map((r) => r.id));
  let list =
    runRiskIds.size > 0
      ? neutralExposure.topDrivers.filter((d) => runRiskIds.has(d.riskId))
      : [...neutralExposure.topDrivers];
  list = list.filter((d) => {
    const risk = risks.find((r) => r.id === d.riskId);
    if (!risk) return true;
    if (appliesToExcludesCost(risk.appliesTo)) return false;
    return typeof risk.preMitigationCostML === "number" && risk.preMitigationCostML > 0;
  });
  return list.map((d) => {
    const risk = risks.find((r) => r.id === d.riskId);
    let preMitigation: number;
    if (risk) {
      const prob01 =
        typeof risk.probability === "number" && risk.probability >= 0 && risk.probability <= 1
          ? risk.probability
          : risk.inherentRating.probability / 5;
      const impact = risk.preMitigationCostML ?? 0;
      preMitigation = impact * prob01;
      if (!Number.isFinite(preMitigation) || preMitigation < 0) preMitigation = d.total;
    } else {
      preMitigation = d.total;
    }
    return {
      riskId: d.riskId,
      riskName: risk?.title ?? d.riskId,
      delta: preMitigation - d.total,
    };
  });
}

/** Schedule drivers aligned with Run Data (snapshot risks, sim mean / expected days). */
export function buildScheduleDriverLines(
  current: SimulationSnapshot | undefined,
  risks: Risk[]
): ScheduleDriverLine[] {
  const list = current?.risks ?? [];
  const sorted = [...list]
    .filter((r) => (r.simMeanDays ?? r.expectedDays ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.simMeanDays ?? b.expectedDays ?? 0) - (a.simMeanDays ?? a.expectedDays ?? 0)
    );
  return sorted.map((r) => {
    const days = r.simMeanDays ?? r.expectedDays ?? 0;
    const risk = risks.find((x) => x.id === r.id);
    let preMitigation: number;
    if (risk) {
      const prob01 =
        typeof risk.probability === "number" && risk.probability >= 0 && risk.probability <= 1
          ? risk.probability
          : risk.inherentRating.probability / 5;
      const impactDays = risk.preMitigationTimeML ?? risk.postMitigationTimeML ?? 0;
      preMitigation = impactDays * prob01;
      if (!Number.isFinite(preMitigation) || preMitigation < 0) preMitigation = days;
    } else {
      preMitigation = days;
    }
    return {
      riskId: r.id,
      riskName: risk?.title ?? r.title ?? r.id,
      totalDays: days,
      delta: preMitigation - days,
    };
  });
}

export function cdfsFromNeutralSnapshot(
  neutral: MonteCarloNeutralSnapshot | undefined
): { costCdf: CostCdfPoint[] | null; timeCdf: TimeCdfPoint[] | null } {
  if (!neutral?.summary) return { costCdf: null, timeCdf: null };
  const s = neutral.summary;
  const costSamples = neutral.costSamples ?? [];
  const timeSamples = neutral.timeSamples ?? [];

  const costCdf =
    costSamples.length > 0
      ? distributionToCostCdf(binSamplesIntoHistogram(costSamples, DISTRIBUTION_BIN_COUNT))
      : distributionToCostCdf(
          deriveCostHistogramFromPercentiles(
            {
              p20Cost: s.p20Cost,
              p50Cost: s.p50Cost,
              p80Cost: s.p80Cost,
              p90Cost: s.p90Cost,
            },
            DISTRIBUTION_BIN_COUNT
          )
        );

  const timeCdf =
    timeSamples.length > 0
      ? distributionToTimeCdf(binSamplesIntoTimeHistogram(timeSamples, DISTRIBUTION_BIN_COUNT))
      : distributionToTimeCdf(
          deriveTimeHistogramFromPercentiles(
            {
              p20Time: s.p20Time,
              p50Time: s.p50Time,
              p80Time: s.p80Time,
              p90Time: s.p90Time,
            },
            DISTRIBUTION_BIN_COUNT
          )
        );

  return { costCdf, timeCdf };
}

export function formatPercentileLabel(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  const rounded = Math.round(Math.min(100, Math.max(0, p)));
  return `P${rounded}`;
}

export function dollarGapVersusTargetPercentile(
  costCdf: CostCdfPoint[] | null,
  targetPercent: number,
  contingencyDollars: number | null
): number | null {
  if (!costCdf || contingencyDollars == null || !Number.isFinite(contingencyDollars)) return null;
  const atTarget = costAtPercentile(costCdf, targetPercent);
  if (atTarget == null || !Number.isFinite(atTarget)) return null;
  return contingencyDollars - atTarget;
}

export function timeGapVersusTargetPercentile(
  timeCdf: TimeCdfPoint[] | null,
  targetPercent: number,
  contingencyDays: number | null
): number | null {
  if (!timeCdf || contingencyDays == null || !Number.isFinite(contingencyDays)) return null;
  const atTarget = timeAtPercentile(timeCdf, targetPercent);
  if (atTarget == null || !Number.isFinite(atTarget)) return null;
  return contingencyDays - atTarget;
}
