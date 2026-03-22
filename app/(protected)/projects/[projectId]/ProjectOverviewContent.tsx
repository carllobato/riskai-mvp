"use client";

import { useMemo } from "react";
import { SummaryTile } from "@/components/dashboard/SummaryTile";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatDurationDays } from "@/lib/formatDuration";
import { loadProjectContext } from "@/lib/projectContext";
import type { SimulationSnapshotRowDb } from "@/lib/db/snapshots";
import {
  costAtPercentile,
  deriveCostHistogramFromPercentiles,
  deriveTimeHistogramFromPercentiles,
  distributionToCostCdf,
  distributionToTimeCdf,
  percentileAtCost,
  percentileAtTime,
  timeAtPercentile,
} from "@/lib/simulationDisplayUtils";

export type ProjectOverviewInitialData = {
  projectId: string;
  projectName: string;
  riskCount: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  reportingSnapshot: SimulationSnapshotRowDb | null;
};

type ProjectOverviewContentProps = {
  initialData: ProjectOverviewInitialData;
};

type SnapshotRisk = {
  id: string;
  title: string;
  category: string;
  simMeanCost: number;
  simMeanDays: number;
  expectedCost: number;
  expectedDays: number;
};

const DISTRIBUTION_BIN_COUNT = 28;

function asFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseRiskAppetitePercent(riskAppetite: string): number {
  const n = Number.parseInt(riskAppetite.replace(/^P/i, ""), 10);
  if (!Number.isFinite(n)) return 80;
  return Math.max(0, Math.min(100, n));
}

function formatReportingMonthYear(ym: string | null | undefined, fallbackIso: string | null | undefined): string {
  if (ym && /^\d{4}-\d{2}$/.test(ym)) {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }
  if (!fallbackIso) return "—";
  const d = new Date(fallbackIso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function formatSignedCurrency(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value === 0) return "$0";
  const sign = value > 0 ? "+" : "−";
  return `${sign}${formatCurrency(Math.abs(value))}`;
}

function formatSignedDuration(valueDays: number | null): string {
  if (valueDays == null || !Number.isFinite(valueDays)) return "—";
  if (valueDays === 0) return "0 days";
  const sign = valueDays > 0 ? "+" : "−";
  return `${sign}${formatDurationDays(Math.abs(valueDays))}`;
}

function normalizeSnapshotRisk(raw: unknown): SnapshotRisk | null {
  if (raw == null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  const title = typeof r.title === "string" && r.title.trim() ? r.title.trim() : "Untitled risk";
  const category = typeof r.category === "string" && r.category.trim() ? r.category.trim() : "—";
  const simMeanCost = asFiniteNumber(r.simMeanCost) ?? 0;
  const simMeanDays = asFiniteNumber(r.simMeanDays) ?? 0;
  const expectedCost = asFiniteNumber(r.expectedCost) ?? 0;
  const expectedDays = asFiniteNumber(r.expectedDays) ?? 0;
  return { id, title, category, simMeanCost, simMeanDays, expectedCost, expectedDays };
}

export function ProjectOverviewContent({ initialData }: ProjectOverviewContentProps) {
  const {
    projectId,
    riskCount,
    highSeverityCount,
    mediumSeverityCount,
    reportingSnapshot,
  } = initialData ?? {
    projectId: "",
    projectName: "",
    riskCount: 0,
    highSeverityCount: 0,
    mediumSeverityCount: 0,
    reportingSnapshot: null,
  };

  const projectContext = useMemo(() => (projectId ? loadProjectContext(projectId) : null), [projectId]);
  const targetConfidenceLabel = projectContext?.riskAppetite ?? "P80";
  const targetConfidencePercent = parseRiskAppetitePercent(targetConfidenceLabel);

  const reportingRunLabel = useMemo(
    () => formatReportingMonthYear(reportingSnapshot?.reporting_month_year, reportingSnapshot?.created_at),
    [reportingSnapshot?.reporting_month_year, reportingSnapshot?.created_at]
  );

  const summary = reportingSnapshot?.payload?.summary;
  const summaryCostP20 = asFiniteNumber(summary?.p20Cost);
  const summaryCostP50 = asFiniteNumber(summary?.p50Cost);
  const summaryCostP80 = asFiniteNumber(summary?.p80Cost);
  const summaryCostP90 = asFiniteNumber(summary?.p90Cost);
  const summaryTimeP20 = asFiniteNumber(summary?.p20Time);
  const summaryTimeP50 = asFiniteNumber(summary?.p50Time);
  const summaryTimeP80 = asFiniteNumber(summary?.p80Time);
  const summaryTimeP90 = asFiniteNumber(summary?.p90Time);

  const costP20 = asFiniteNumber(reportingSnapshot?.cost_p20) ?? summaryCostP20;
  const costP50 = asFiniteNumber(reportingSnapshot?.cost_p50) ?? summaryCostP50;
  const costP80 = asFiniteNumber(reportingSnapshot?.cost_p80) ?? summaryCostP80;
  const costP90 = asFiniteNumber(reportingSnapshot?.cost_p90) ?? summaryCostP90;
  const timeP20 = asFiniteNumber(reportingSnapshot?.time_p20) ?? summaryTimeP20;
  const timeP50 = asFiniteNumber(reportingSnapshot?.time_p50) ?? summaryTimeP50;
  const timeP80 = asFiniteNumber(reportingSnapshot?.time_p80) ?? summaryTimeP80;
  const timeP90 = asFiniteNumber(reportingSnapshot?.time_p90) ?? summaryTimeP90;

  const costSummary = useMemo(
    () =>
      costP20 != null && costP50 != null && costP80 != null && costP90 != null
        ? { p20Cost: costP20, p50Cost: costP50, p80Cost: costP80, p90Cost: costP90 }
        : null,
    [costP20, costP50, costP80, costP90]
  );

  const timeSummary = useMemo(
    () =>
      timeP20 != null && timeP50 != null && timeP80 != null && timeP90 != null
        ? { p20Time: timeP20, p50Time: timeP50, p80Time: timeP80, p90Time: timeP90 }
        : null,
    [timeP20, timeP50, timeP80, timeP90]
  );

  const costCdf = useMemo(() => {
    if (!costSummary) return null;
    return distributionToCostCdf(
      deriveCostHistogramFromPercentiles(
        {
          p20Cost: costSummary.p20Cost,
          p50Cost: costSummary.p50Cost,
          p80Cost: costSummary.p80Cost,
          p90Cost: costSummary.p90Cost,
        },
        DISTRIBUTION_BIN_COUNT
      )
    );
  }, [costSummary]);

  const timeCdf = useMemo(() => {
    if (!timeSummary) return null;
    return distributionToTimeCdf(
      deriveTimeHistogramFromPercentiles(
        {
          p20Time: timeSummary.p20Time,
          p50Time: timeSummary.p50Time,
          p80Time: timeSummary.p80Time,
          p90Time: timeSummary.p90Time,
        },
        DISTRIBUTION_BIN_COUNT
      )
    );
  }, [timeSummary]);

  const contingencyValueDollars =
    projectContext?.contingencyValue_m != null && Number.isFinite(projectContext.contingencyValue_m)
      ? projectContext.contingencyValue_m * 1e6
      : null;
  const plannedDurationDays =
    projectContext?.plannedDuration_months != null &&
    Number.isFinite(projectContext.plannedDuration_months) &&
    projectContext.plannedDuration_months > 0
      ? (projectContext.plannedDuration_months * 365) / 12
      : null;
  const scheduleContingencyDays =
    projectContext?.scheduleContingency_weeks != null &&
    Number.isFinite(projectContext.scheduleContingency_weeks)
      ? projectContext.scheduleContingency_weeks * 7
      : null;

  const currentCostPosition = useMemo(() => {
    if (!costCdf?.length || contingencyValueDollars == null || contingencyValueDollars <= 0) return null;
    const p = percentileAtCost(costCdf, contingencyValueDollars);
    return p != null ? Math.round(p) : null;
  }, [costCdf, contingencyValueDollars]);

  const currentTimePosition = useMemo(() => {
    if (!timeCdf?.length || plannedDurationDays == null || plannedDurationDays <= 0) return null;
    const p = percentileAtTime(timeCdf, plannedDurationDays);
    return p != null ? Math.round(p) : null;
  }, [timeCdf, plannedDurationDays]);

  const costAtTarget = useMemo(() => {
    if (!costCdf?.length) return null;
    return costAtPercentile(costCdf, targetConfidencePercent);
  }, [costCdf, targetConfidencePercent]);

  const timeAtTarget = useMemo(() => {
    if (!timeCdf?.length) return null;
    return timeAtPercentile(timeCdf, targetConfidencePercent);
  }, [timeCdf, targetConfidencePercent]);

  const costGapToTarget =
    costAtTarget != null && contingencyValueDollars != null ? costAtTarget - contingencyValueDollars : null;
  const timeGapToTarget =
    timeAtTarget != null && plannedDurationDays != null ? timeAtTarget - plannedDurationDays : null;

  const costContingencyRemaining =
    contingencyValueDollars != null && costSummary?.p50Cost != null
      ? contingencyValueDollars - costSummary.p50Cost
      : null;
  const timeContingencyRemaining =
    scheduleContingencyDays != null && timeSummary?.p50Time != null
      ? scheduleContingencyDays - timeSummary.p50Time
      : null;

  const snapshotRisks = useMemo(() => {
    const raw = reportingSnapshot?.payload?.risks;
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeSnapshotRisk).filter((r): r is SnapshotRisk => r != null);
  }, [reportingSnapshot?.payload?.risks]);

  const keyCostRisk = useMemo(() => {
    return [...snapshotRisks]
      .sort(
        (a, b) =>
          (b.simMeanCost || b.expectedCost || 0) - (a.simMeanCost || a.expectedCost || 0)
      )
      .find((r) => (r.simMeanCost || r.expectedCost || 0) > 0);
  }, [snapshotRisks]);

  const keyTimeRisk = useMemo(() => {
    return [...snapshotRisks]
      .sort(
        (a, b) =>
          (b.simMeanDays || b.expectedDays || 0) - (a.simMeanDays || a.expectedDays || 0)
      )
      .find((r) => (r.simMeanDays || r.expectedDays || 0) > 0);
  }, [snapshotRisks]);

  const keyOpportunity = useMemo(() => {
    const opportunities = snapshotRisks
      .map((r) => {
        const cost = r.simMeanCost || r.expectedCost || 0;
        const time = r.simMeanDays || r.expectedDays || 0;
        const score = Math.abs(Math.min(0, cost)) + Math.abs(Math.min(0, time));
        return { risk: r, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    return opportunities[0]?.risk ?? null;
  }, [snapshotRisks]);

  const projectStatus = useMemo(() => {
    if (highSeverityCount > 0) {
      return {
        label: "Red",
        className: "text-red-700 dark:text-red-400",
        support: `${highSeverityCount} high/extreme residual risk${highSeverityCount !== 1 ? "s" : ""}`,
      };
    }
    if (mediumSeverityCount > 0) {
      return {
        label: "Amber",
        className: "text-amber-700 dark:text-amber-400",
        support: `${mediumSeverityCount} medium residual risk${mediumSeverityCount !== 1 ? "s" : ""}`,
      };
    }
    return {
      label: "Green",
      className: "text-emerald-700 dark:text-emerald-400",
      support:
        riskCount > 0
          ? "No medium/high residual risks in current register"
          : "No active risks recorded",
    };
  }, [highSeverityCount, mediumSeverityCount, riskCount]);

  return (
    <main className="p-6 max-w-6xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-lg font-semibold m-0 text-[var(--foreground)]">Project Overview</h2>
        {reportingSnapshot && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 m-0 mt-1">
            Reporting Run: {reportingRunLabel}
          </p>
        )}
      </div>

      {!reportingSnapshot ? (
        <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-6">
          <p className="text-base font-semibold text-[var(--foreground)] m-0">No reporting run locked</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 m-0 mt-1">
            Lock a simulation for reporting to populate Overview
          </p>
        </section>
      ) : (
        <div className="space-y-6">
          <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4">
            <h3 className="text-sm font-semibold text-[var(--foreground)] m-0 mb-3">Status</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 m-0">
                  Project Status (RAG)
                </p>
                <p className={`text-2xl font-semibold m-0 mt-1 ${projectStatus.className}`}>
                  {projectStatus.label}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 m-0 mt-1">
                  {projectStatus.support}
                </p>
              </div>
              <SummaryTile
                title="Target Confidence"
                primaryValue={targetConfidenceLabel}
                subtext="From Project Settings → Risk Appetite"
              />
            </div>
          </section>

          <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4">
            <h3 className="text-sm font-semibold text-[var(--foreground)] m-0 mb-3">Position</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SummaryTile
                title="Current Cost Position"
                primaryValue={currentCostPosition != null ? `P${currentCostPosition}` : "—"}
                subtext={
                  contingencyValueDollars != null
                    ? "Confidence at current contingency"
                    : "Set contingency in Project Settings"
                }
              />
              <SummaryTile
                title="Current Time Position"
                primaryValue={currentTimePosition != null ? `P${currentTimePosition}` : "—"}
                subtext={
                  plannedDurationDays != null
                    ? "Confidence at planned duration"
                    : "Set planned duration in Project Settings"
                }
              />
            </div>
          </section>

          <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4">
            <h3 className="text-sm font-semibold text-[var(--foreground)] m-0 mb-3">Impact</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SummaryTile
                title="$ Gap to Target"
                primaryValue={formatSignedCurrency(costGapToTarget)}
                subtext={`Target ${targetConfidenceLabel}`}
              />
              <SummaryTile
                title="Time Gap to Target"
                primaryValue={formatSignedDuration(timeGapToTarget)}
                subtext={`Target ${targetConfidenceLabel}`}
              />
            </div>
          </section>

          <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4">
            <h3 className="text-sm font-semibold text-[var(--foreground)] m-0 mb-3">Buffer</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SummaryTile
                title="$ Contingency Remaining"
                primaryValue={formatSignedCurrency(costContingencyRemaining)}
                subtext="Contingency less reporting-run P50 cost"
              />
              <SummaryTile
                title="Time Contingency Remaining"
                primaryValue={formatSignedDuration(timeContingencyRemaining)}
                subtext="Schedule contingency less reporting-run P50 time"
              />
            </div>
          </section>

          <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4">
            <h3 className="text-sm font-semibold text-[var(--foreground)] m-0 mb-3">Insight</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SummaryTile
                title="Key Cost Risk (Top 1)"
                primaryValue={keyCostRisk?.title ?? "—"}
                subtext={
                  keyCostRisk
                    ? `${formatCurrency(Math.max(0, keyCostRisk.simMeanCost || keyCostRisk.expectedCost))} (${keyCostRisk.category})`
                    : "No cost driver in locked reporting run"
                }
              />
              <SummaryTile
                title="Key Time Risk (Top 1)"
                primaryValue={keyTimeRisk?.title ?? "—"}
                subtext={
                  keyTimeRisk
                    ? `${formatDurationDays(Math.max(0, keyTimeRisk.simMeanDays || keyTimeRisk.expectedDays))} (${keyTimeRisk.category})`
                    : "No schedule driver in locked reporting run"
                }
              />
              <SummaryTile
                title="Key Opportunity (Top 1)"
                primaryValue={keyOpportunity?.title ?? "—"}
                subtext={
                  keyOpportunity
                    ? `${formatCurrency(Math.abs(Math.min(0, keyOpportunity.simMeanCost || keyOpportunity.expectedCost)))} cost or ${formatDurationDays(Math.abs(Math.min(0, keyOpportunity.simMeanDays || keyOpportunity.expectedDays)))} time`
                    : "No opportunity output available"
                }
              />
            </div>
          </section>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-8 pt-4 border-t border-neutral-200 dark:border-neutral-700">
        <p className="text-sm text-neutral-500 dark:text-neutral-400 m-0">
          Latest locked reporting run · Read-only snapshot
        </p>
      </footer>
    </main>
  );
}
