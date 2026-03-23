"use client";

import { useEffect, useMemo, useState } from "react";
import { SummaryTile } from "@/components/dashboard/SummaryTile";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatDurationDays } from "@/lib/formatDuration";
import {
  type ProjectContext,
  loadProjectContext,
} from "@/lib/projectContext";
import type {
  SimulationSnapshotRow,
  SimulationSnapshotRowDb,
} from "@/lib/db/snapshots";
import type { RagStatus } from "@/lib/dashboard/projectTileServerData";
import {
  costAtPercentile,
  deriveCostHistogramFromPercentiles,
  deriveTimeHistogramFromPercentiles,
  distributionToCostCdf,
  distributionToTimeCdf,
  percentileAtCost,
  percentileAtTime,
  timeAtPercentile,
  type DistributionPoint,
  type TimeDistributionPoint,
} from "@/lib/simulationDisplayUtils";

export type ProjectOverviewInitialData = {
  projectId: string;
  projectName: string;
  ragStatus: RagStatus;
  riskCount: number;
  latestLockedSnapshot: SimulationSnapshotRow | null;
};

type ProjectOverviewContentProps = {
  initialData: ProjectOverviewInitialData;
};

type SnapshotRisk = {
  id: string;
  title: string;
  simMeanCost?: number;
  expectedCost?: number;
  simMeanDays?: number;
  expectedDays?: number;
};

function asFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstFinite(...values: unknown[]): number | null {
  for (const value of values) {
    const n = asFiniteNumber(value);
    if (n != null) return n;
  }
  return null;
}

function parseTargetPercent(riskAppetite: string): number {
  const n = parseInt(riskAppetite.replace(/^P/i, ""), 10);
  if (!Number.isFinite(n)) return 80;
  return Math.max(1, Math.min(99, n));
}

function formatSignedCurrency(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = formatCurrency(Math.abs(value));
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return abs;
}

function formatSignedDuration(valueDays: number | null): string {
  if (valueDays == null || !Number.isFinite(valueDays)) return "—";
  const abs = formatDurationDays(Math.abs(valueDays));
  if (valueDays > 0) return `+${abs}`;
  if (valueDays < 0) return `-${abs}`;
  return abs;
}

function formatPValue(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `P${Math.round(value)}`;
}

function formatReportingRun(value: string | null | undefined): string {
  if (!value) return "—";
  const ymMatch = /^(\d{4})-(\d{2})$/.exec(value);
  if (ymMatch) {
    const y = Number(ymMatch[1]);
    const m = Number(ymMatch[2]);
    return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function statusLabel(status: RagStatus): string {
  if (status === "red") return "Red";
  if (status === "amber") return "Amber";
  return "Green";
}

function statusToneClass(status: RagStatus): string {
  if (status === "red") return "text-red-700 dark:text-red-300";
  if (status === "amber") return "text-amber-700 dark:text-amber-300";
  return "text-emerald-700 dark:text-emerald-300";
}

function getSnapshotRisks(snapshot: SimulationSnapshotRowDb | null): SnapshotRisk[] {
  const list = snapshot?.payload?.risks;
  if (!Array.isArray(list)) return [];
  return list as SnapshotRisk[];
}

export function ProjectOverviewContent({ initialData }: ProjectOverviewContentProps) {
  const { projectId, riskCount, ragStatus, latestLockedSnapshot } = initialData ?? {
    projectId: "",
    projectName: "",
    ragStatus: "amber" as const,
    riskCount: 0,
    latestLockedSnapshot: null,
  };
  const [projectContext, setProjectContext] = useState<ProjectContext | null>(null);

  useEffect(() => {
    const syncContext = () => setProjectContext(loadProjectContext(projectId));
    syncContext();
    window.addEventListener("focus", syncContext);
    window.addEventListener("storage", syncContext);
    return () => {
      window.removeEventListener("focus", syncContext);
      window.removeEventListener("storage", syncContext);
    };
  }, [projectId]);

  const reportingSnapshot = latestLockedSnapshot as SimulationSnapshotRowDb | null;
  const reportingRunLabel = useMemo(
    () =>
      formatReportingRun(
        reportingSnapshot?.report_month ??
          reportingSnapshot?.locked_at ??
          reportingSnapshot?.created_at
      ),
    [reportingSnapshot]
  );

  const targetConfidence = projectContext?.riskAppetite ?? "P80";
  const targetPercent = parseTargetPercent(targetConfidence);
  const contingencyHeld: number | null =
    projectContext?.contingencyValue_m != null &&
    Number.isFinite(projectContext.contingencyValue_m)
      ? projectContext.contingencyValue_m * 1e6
      : null;
  const plannedDurationDays =
    projectContext?.plannedDuration_months != null &&
    Number.isFinite(projectContext.plannedDuration_months)
      ? (projectContext.plannedDuration_months * 365) / 12
      : null;
  const scheduleBufferDays =
    projectContext?.scheduleContingency_weeks != null && Number.isFinite(projectContext.scheduleContingency_weeks)
      ? projectContext.scheduleContingency_weeks * 7
      : null;

  const costDistribution = useMemo((): DistributionPoint[] => {
    if (!reportingSnapshot) return [];
    const fromPayload = reportingSnapshot.payload?.distributions?.costHistogram ?? [];
    if (fromPayload.length > 0) return fromPayload;
    const p50 = firstFinite(reportingSnapshot.cost_p50, reportingSnapshot.payload?.summary?.p50Cost);
    const p80 = firstFinite(
      reportingSnapshot.cost_p80,
      reportingSnapshot.payload?.summary?.p80Cost
    );
    const p90 = firstFinite(reportingSnapshot.cost_p90, reportingSnapshot.payload?.summary?.p90Cost);
    if (p50 == null || p80 == null || p90 == null) return [];
    return deriveCostHistogramFromPercentiles({ p50Cost: p50, p80Cost: p80, p90Cost: p90 }, 40);
  }, [reportingSnapshot]);

  const timeDistribution = useMemo((): TimeDistributionPoint[] => {
    if (!reportingSnapshot) return [];
    const fromPayload = reportingSnapshot.payload?.distributions?.timeHistogram ?? [];
    if (fromPayload.length > 0) return fromPayload;
    const p50 = firstFinite(reportingSnapshot.time_p50, reportingSnapshot.payload?.summary?.p50Time);
    const p80 = firstFinite(
      reportingSnapshot.time_p80,
      reportingSnapshot.payload?.summary?.p80Time
    );
    const p90 = firstFinite(reportingSnapshot.time_p90, reportingSnapshot.payload?.summary?.p90Time);
    if (p50 == null || p80 == null || p90 == null) return [];
    return deriveTimeHistogramFromPercentiles({ p50Time: p50, p80Time: p80, p90Time: p90 }, 40);
  }, [reportingSnapshot]);

  const costCdf = useMemo(
    () => (costDistribution.length > 0 ? distributionToCostCdf(costDistribution) : []),
    [costDistribution]
  );
  const timeCdf = useMemo(
    () => (timeDistribution.length > 0 ? distributionToTimeCdf(timeDistribution) : []),
    [timeDistribution]
  );

  const currentCostPosition = useMemo(() => {
    if (!costCdf.length || contingencyHeld == null || contingencyHeld <= 0) return null;
    const value = percentileAtCost(costCdf, contingencyHeld);
    return value != null ? Math.round(value) : null;
  }, [costCdf, contingencyHeld]);

  const currentTimePosition = useMemo(() => {
    if (!timeCdf.length || plannedDurationDays == null || plannedDurationDays <= 0) return null;
    const value = percentileAtTime(timeCdf, plannedDurationDays);
    return value != null ? Math.round(value) : null;
  }, [timeCdf, plannedDurationDays]);

  const costAtTarget = useMemo(
    () => (costCdf.length > 0 ? costAtPercentile(costCdf, targetPercent) : null),
    [costCdf, targetPercent]
  );
  const timeAtTarget = useMemo(
    () => (timeCdf.length > 0 ? timeAtPercentile(timeCdf, targetPercent) : null),
    [timeCdf, targetPercent]
  );

  const costGapToTarget =
    costAtTarget != null && contingencyHeld != null ? costAtTarget - contingencyHeld : null;
  const timeGapToTarget =
    timeAtTarget != null && plannedDurationDays != null ? timeAtTarget - plannedDurationDays : null;

  const costMean = firstFinite(
    reportingSnapshot?.cost_mean,
    reportingSnapshot?.payload?.summary?.meanCost
  );
  const timeMean = firstFinite(
    reportingSnapshot?.time_mean,
    reportingSnapshot?.payload?.summary?.meanTime
  );
  const costContingencyRemaining =
    contingencyHeld != null && costMean != null ? contingencyHeld - costMean : null;
  const timeContingencyRemaining =
    scheduleBufferDays != null && timeMean != null ? scheduleBufferDays - timeMean : null;

  const snapshotRisks = useMemo(
    () => getSnapshotRisks(reportingSnapshot),
    [reportingSnapshot]
  );

  const keyCostRisk = useMemo(() => {
    const sorted = [...snapshotRisks]
      .map((risk) => ({
        ...risk,
        impact: firstFinite(risk.simMeanCost, risk.expectedCost) ?? 0,
      }))
      .filter((risk) => risk.impact > 0)
      .sort((a, b) => b.impact - a.impact);
    return sorted[0] ?? null;
  }, [snapshotRisks]);

  const keyTimeRisk = useMemo(() => {
    const sorted = [...snapshotRisks]
      .map((risk) => ({
        ...risk,
        impact: firstFinite(risk.simMeanDays, risk.expectedDays) ?? 0,
      }))
      .filter((risk) => risk.impact > 0)
      .sort((a, b) => b.impact - a.impact);
    return sorted[0] ?? null;
  }, [snapshotRisks]);

  const keyOpportunity = useMemo(() => {
    const opportunity = snapshotRisks.find((risk) => {
      const cost = firstFinite(risk.simMeanCost, risk.expectedCost);
      const days = firstFinite(risk.simMeanDays, risk.expectedDays);
      return (cost != null && cost < 0) || (days != null && days < 0);
    });
    return opportunity ?? null;
  }, [snapshotRisks]);

  return (
    <main className="p-6 max-w-6xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-lg font-semibold m-0 text-[var(--foreground)]">Project Overview</h2>
        {reportingSnapshot && (
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Reporting Run: {reportingRunLabel}
          </p>
        )}
      </div>

      {!reportingSnapshot ? (
        <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-6">
          <p className="text-base font-semibold text-[var(--foreground)] m-0">
            No reporting run locked
          </p>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 m-0">
            Lock a simulation for reporting to populate Overview
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          <DashboardCard title="Status">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SummaryTile
                title="Project Status (RAG)"
                primaryValue={statusLabel(ragStatus)}
                subtext={`${riskCount} active risks · RiskAI thresholds`}
              />
              <SummaryTile
                title="Target Confidence"
                primaryValue={targetConfidence}
                subtext="From Project Settings risk appetite"
              />
            </div>
            <p className={`mt-2 mb-0 text-xs font-medium ${statusToneClass(ragStatus)}`}>
              {statusLabel(ragStatus)}
            </p>
          </DashboardCard>

          <DashboardCard title="Position">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SummaryTile
                title="Current Cost Position"
                primaryValue={formatPValue(currentCostPosition)}
              />
              <SummaryTile
                title="Current Time Position"
                primaryValue={formatPValue(currentTimePosition)}
              />
            </div>
          </DashboardCard>

          <DashboardCard title="Impact">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SummaryTile
                title="$ Gap to Target"
                primaryValue={formatSignedCurrency(costGapToTarget)}
              />
              <SummaryTile
                title="Time Gap to Target"
                primaryValue={formatSignedDuration(timeGapToTarget)}
              />
            </div>
          </DashboardCard>

          <DashboardCard title="Buffer">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SummaryTile
                title="$ Contingency Remaining"
                primaryValue={formatSignedCurrency(costContingencyRemaining)}
              />
              <SummaryTile
                title="Time Contingency Remaining"
                primaryValue={formatSignedDuration(timeContingencyRemaining)}
              />
            </div>
          </DashboardCard>

          <DashboardCard title="Insight">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <SummaryTile
                title="Key Cost Risk (Top 1)"
                primaryValue={keyCostRisk?.title ?? "—"}
                subtext={
                  keyCostRisk
                    ? formatCurrency(
                        firstFinite(keyCostRisk.simMeanCost, keyCostRisk.expectedCost) ?? 0
                      )
                    : "No cost risk in reporting run"
                }
              />
              <SummaryTile
                title="Key Time Risk (Top 1)"
                primaryValue={keyTimeRisk?.title ?? "—"}
                subtext={
                  keyTimeRisk
                    ? formatDurationDays(
                        firstFinite(keyTimeRisk.simMeanDays, keyTimeRisk.expectedDays) ?? 0
                      )
                    : "No schedule risk in reporting run"
                }
              />
              <SummaryTile
                title="Key Opportunity (Top 1)"
                primaryValue={keyOpportunity?.title ?? "No opportunity identified"}
                subtext="Opportunity output not available in current run payload"
              />
            </div>
          </DashboardCard>
        </div>
      )}
    </main>
  );
}
