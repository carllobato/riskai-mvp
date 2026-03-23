"use client";

import Link from "next/link";
import { useMemo, useEffect, useState } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildSimulationFromDbRow, useRiskRegister } from "@/store/risk-register.store";
import { listRisks } from "@/lib/db/risks";
import {
  loadProjectContext,
  riskAppetiteToPercent,
  type RiskAppetite,
} from "@/lib/projectContext";
import { formatReportMonthLabel, type SimulationSnapshotRow } from "@/lib/db/snapshots";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatDurationDays } from "@/lib/formatDuration";
import { DASHBOARD_PATH, riskaiPath } from "@/lib/routes";
import type { Risk } from "@/domain/risk/risk.schema";
import { isRiskStatusArchived } from "@/domain/risk/riskFieldSemantics";
import { computeRag, type RagStatus } from "@/lib/dashboard/projectTileServerData";
import {
  buildCostDriverLines,
  buildScheduleDriverLines,
  computeNeutralForwardExposure,
  formatPercentileLabel,
  interpolateSnapshotAtRiskPercentile,
  nearestReportingAnchorPercentile,
  optionalBufferFromSnapshotPayload,
  snapshotCostAtAnchor,
  snapshotTimeAtAnchor,
  topCostRiskTitleFromSnapshotPayload,
  topTimeRiskTitleFromSnapshotPayload,
} from "@/lib/projectOverviewReporting";

type CdfChartPoint = { x: number; p: number };

const CHART_HEIGHT = 200;
const CHART_MARGIN = { top: 8, right: 12, left: 4, bottom: 4 };
/** Reference lines: hue from theme only; distinguish by weight and dash. */
const REF_CURRENT_OPACITY = 0.55;
const REF_TARGET_OPACITY = 0.35;

function formatSignedDollarGap(meanCost: number | null, appetiteLineCost: number | null): string {
  if (meanCost == null || appetiteLineCost == null) return "—";
  if (!Number.isFinite(meanCost) || !Number.isFinite(appetiteLineCost)) return "—";
  const d = meanCost - appetiteLineCost;
  if (d === 0) return formatCurrency(0);
  const sign = d < 0 ? "-" : "+";
  return `${sign}${formatCurrency(Math.abs(d))}`;
}

function formatSignedTimeGap(meanDays: number | null, appetiteLineDays: number | null): string {
  if (meanDays == null || appetiteLineDays == null) return "—";
  if (!Number.isFinite(meanDays) || !Number.isFinite(appetiteLineDays)) return "—";
  const d = meanDays - appetiteLineDays;
  if (d === 0) return formatDurationDays(0);
  const sign = d < 0 ? "-" : "+";
  return `${sign}${formatDurationDays(Math.abs(d))}`;
}

export type ProjectOverviewInitialData = {
  projectId: string;
  /** Latest row with `locked_for_reporting`; null if none. */
  reportingSnapshot: SimulationSnapshotRow | null;
};

type ProjectOverviewContentProps = {
  initialData: ProjectOverviewInitialData;
};

function ragPresentation(status: RagStatus): { label: string; badgeClass: string } {
  switch (status) {
    case "green":
      return {
        label: "Healthy",
        badgeClass:
          "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/25",
      };
    case "amber":
      return {
        label: "Watch",
        badgeClass: "bg-amber-500/15 text-amber-900 dark:text-amber-300 ring-1 ring-amber-500/25",
      };
    case "red":
      return {
        label: "At risk",
        badgeClass: "bg-red-500/15 text-red-800 dark:text-red-300 ring-1 ring-red-500/25",
      };
    default:
      return {
        label: "—",
        badgeClass: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 ring-1 ring-neutral-500/20",
      };
  }
}

function countActiveRisks(risks: Risk[]): number {
  return risks.filter((r) => !isRiskStatusArchived(r.status)).length;
}

function countHighSeverityActive(risks: Risk[]): number {
  return risks.filter((r) => !isRiskStatusArchived(r.status)).filter((r) => {
    const lv = r.residualRating?.level;
    return lv === "high" || lv === "extreme";
  }).length;
}

function DashCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-neutral-100/70 dark:bg-white/[0.06] p-5 shadow-sm ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function BufferBar({ fraction }: { fraction: number | null }) {
  const pct = fraction == null ? null : Math.round(Math.min(100, Math.max(0, fraction * 100)));
  return (
    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-200/90 dark:bg-neutral-700/80">
      {pct != null ? (
        <div
          className="h-full rounded-full bg-neutral-600 dark:bg-neutral-400 transition-[width] duration-300"
          style={{ width: `${Math.max(pct, 3)}%` }}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
        />
      ) : null}
    </div>
  );
}

function DistributionMiniChart({
  title,
  points,
  currentX,
  targetX,
  targetLabel,
  formatX,
}: {
  title: string;
  points: CdfChartPoint[];
  currentX: number | null;
  targetX: number | null;
  targetLabel: string;
  formatX: (n: number) => string;
}) {
  const hasLine = points.length >= 2;
  const stroke = "var(--foreground)";

  return (
    <DashCard className="flex flex-col gap-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400 m-0">
        {title}
      </h3>
      {!hasLine ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 m-0 py-8 text-center">Unavailable</p>
      ) : (
        <div className="w-full min-h-[200px]" style={{ height: CHART_HEIGHT }} aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={CHART_MARGIN}>
              <XAxis
                type="number"
                dataKey="x"
                domain={["dataMin", "dataMax"]}
                tick={{ fontSize: 10, fill: "var(--foreground)", opacity: 0.5 }}
                tickFormatter={(v) => formatX(Number(v))}
                axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.12 }}
                tickLine={{ stroke: "var(--foreground)", strokeOpacity: 0.12 }}
              />
              <YAxis
                type="number"
                dataKey="p"
                domain={[0, 100]}
                width={32}
                tick={{ fontSize: 10, fill: "var(--foreground)", opacity: 0.5 }}
                tickFormatter={(v) => `P${v}`}
                axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.12 }}
                tickLine={{ stroke: "var(--foreground)", strokeOpacity: 0.12 }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--background)",
                  border: "1px solid oklch(0.85 0.01 250 / 0.35)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value) => [`P${value ?? ""}`, "Band"]}
                labelFormatter={(v) => formatX(Number(v))}
              />
              <Line
                type="monotone"
                dataKey="p"
                stroke={stroke}
                strokeWidth={2}
                dot={{ r: 3, fill: stroke, strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              {currentX != null && Number.isFinite(currentX) ? (
                <ReferenceLine
                  x={currentX}
                  stroke="var(--foreground)"
                  strokeOpacity={REF_CURRENT_OPACITY}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
              ) : null}
              {targetX != null && Number.isFinite(targetX) ? (
                <ReferenceLine
                  x={targetX}
                  stroke="var(--foreground)"
                  strokeOpacity={REF_TARGET_OPACITY}
                  strokeWidth={2}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {hasLine ? (
        <div className="flex flex-wrap gap-4 text-[11px] text-neutral-500 dark:text-neutral-400">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0.5 w-4 border-t-2 border-dashed border-[var(--foreground)] opacity-55"
              aria-hidden
            />
            Mean (current)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-sm bg-[var(--foreground)] opacity-35" aria-hidden />
            Target ({targetLabel})
          </span>
        </div>
      ) : null}
    </DashCard>
  );
}

export function ProjectOverviewContent({ initialData }: ProjectOverviewContentProps) {
  const { projectId, reportingSnapshot } = initialData ?? {
    projectId: "",
    reportingSnapshot: null,
  };

  const { setRisks } = useRiskRegister();
  const [risks, setRisksLocal] = useState<Risk[]>([]);
  const [loadingRisks, setLoadingRisks] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setLoadingRisks(false);
      return;
    }
    setLoadingRisks(true);
    listRisks(projectId)
      .then((loaded) => {
        setRisks(loaded);
        setRisksLocal(loaded);
      })
      .catch((err) => console.error("[ProjectOverview] load risks", err))
      .finally(() => setLoadingRisks(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const builtFromReporting = useMemo(() => {
    if (!reportingSnapshot) return null;
    return buildSimulationFromDbRow(reportingSnapshot);
  }, [reportingSnapshot]);

  const projectContext = useMemo(
    () => (projectId ? loadProjectContext(projectId) : null),
    [projectId]
  );

  const targetAppetite: RiskAppetite = projectContext?.riskAppetite ?? "P80";
  const targetPercent = riskAppetiteToPercent(targetAppetite);

  const contingencyDollars: number | null =
    projectContext?.contingencyValue_m != null && Number.isFinite(projectContext.contingencyValue_m)
      ? projectContext.contingencyValue_m * 1e6
      : null;

  const scheduleContingencyDays: number | null =
    projectContext?.scheduleContingency_weeks != null &&
    Number.isFinite(projectContext.scheduleContingency_weeks)
      ? projectContext.scheduleContingency_weeks * 7
      : null;

  const current = builtFromReporting?.current;

  const neutralExposure = useMemo(
    () => (risks.length > 0 ? computeNeutralForwardExposure(risks) : null),
    [risks]
  );

  const costDrivers = useMemo(() => {
    if (!neutralExposure) return [];
    return buildCostDriverLines(current, risks, neutralExposure);
  }, [current, risks, neutralExposure]);

  const scheduleDrivers = useMemo(() => buildScheduleDriverLines(current, risks), [current, risks]);

  const keyCostRisk =
    costDrivers[0]?.riskName ?? topCostRiskTitleFromSnapshotPayload(reportingSnapshot);
  const keyTimeRisk =
    scheduleDrivers[0]?.riskName ?? topTimeRiskTitleFromSnapshotPayload(reportingSnapshot);

  const keyOpportunityInfo = useMemo(() => {
    const best = [...costDrivers].filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta)[0];
    return best ? { name: best.riskName, delta: best.delta } : null;
  }, [costDrivers]);

  const keyCostRiskImpact = useMemo(() => {
    const id = costDrivers[0]?.riskId;
    if (!id || !neutralExposure) return null;
    const t = neutralExposure.topDrivers.find((d) => d.riskId === id);
    return t != null && Number.isFinite(t.total) && t.total >= 0 ? t.total : null;
  }, [costDrivers, neutralExposure]);

  const keyTimeRiskDays = scheduleDrivers[0]?.totalDays ?? null;

  const snapshotPayloadBuffer = useMemo(
    () => (reportingSnapshot ? optionalBufferFromSnapshotPayload(reportingSnapshot) : null),
    [reportingSnapshot]
  );

  const costAtAppetiteLine = useMemo(
    () =>
      reportingSnapshot
        ? interpolateSnapshotAtRiskPercentile(reportingSnapshot, targetPercent, "cost")
        : null,
    [reportingSnapshot, targetPercent]
  );

  const timeAtAppetiteLine = useMemo(
    () =>
      reportingSnapshot
        ? interpolateSnapshotAtRiskPercentile(reportingSnapshot, targetPercent, "time")
        : null,
    [reportingSnapshot, targetPercent]
  );

  const meanCostFromSnapshot = useMemo(() => {
    if (!reportingSnapshot) return null;
    const m = Number(reportingSnapshot.cost_mean);
    return Number.isFinite(m) ? m : null;
  }, [reportingSnapshot]);

  const meanTimeFromSnapshot = useMemo(() => {
    if (!reportingSnapshot) return null;
    const m = Number(reportingSnapshot.time_mean);
    return Number.isFinite(m) ? m : null;
  }, [reportingSnapshot]);

  const dollarGapLabel = useMemo(
    () => formatSignedDollarGap(meanCostFromSnapshot, costAtAppetiteLine),
    [meanCostFromSnapshot, costAtAppetiteLine]
  );

  const timeGapLabel = useMemo(
    () => formatSignedTimeGap(meanTimeFromSnapshot, timeAtAppetiteLine),
    [meanTimeFromSnapshot, timeAtAppetiteLine]
  );

  const dollarGapSigned =
    meanCostFromSnapshot != null && costAtAppetiteLine != null
      ? meanCostFromSnapshot - costAtAppetiteLine
      : null;

  const timeGapSigned =
    meanTimeFromSnapshot != null && timeAtAppetiteLine != null
      ? meanTimeFromSnapshot - timeAtAppetiteLine
      : null;

  const nearestAnchor = useMemo(
    () => nearestReportingAnchorPercentile(targetPercent),
    [targetPercent]
  );

  const currentConfidenceLabel = useMemo(() => {
    if (!reportingSnapshot) return null;
    const v = snapshotCostAtAnchor(reportingSnapshot, nearestAnchor);
    if (v == null) return null;
    return formatPercentileLabel(nearestAnchor);
  }, [reportingSnapshot, nearestAnchor]);

  const costCdfPoints = useMemo((): CdfChartPoint[] => {
    if (!reportingSnapshot) return [];
    const anchors = [20, 50, 80, 90] as const;
    const pts: CdfChartPoint[] = [];
    for (const a of anchors) {
      const v = snapshotCostAtAnchor(reportingSnapshot, a);
      if (v != null && Number.isFinite(v)) pts.push({ x: v, p: a });
    }
    pts.sort((x, y) => x.x - y.x);
    return pts;
  }, [reportingSnapshot]);

  const timeCdfPoints = useMemo((): CdfChartPoint[] => {
    if (!reportingSnapshot) return [];
    const anchors = [20, 50, 80, 90] as const;
    const pts: CdfChartPoint[] = [];
    for (const a of anchors) {
      const v = snapshotTimeAtAnchor(reportingSnapshot, a);
      if (v != null && Number.isFinite(v)) pts.push({ x: v, p: a });
    }
    pts.sort((x, y) => x.x - y.x);
    return pts;
  }, [reportingSnapshot]);

  const bufferCostNumeric =
    snapshotPayloadBuffer?.costDollars != null
      ? snapshotPayloadBuffer.costDollars
      : contingencyDollars != null
        ? contingencyDollars
        : null;

  const bufferTimeNumeric =
    snapshotPayloadBuffer?.timeDays != null
      ? snapshotPayloadBuffer.timeDays
      : scheduleContingencyDays != null
        ? scheduleContingencyDays
        : null;

  const bufferCostDisplay =
    bufferCostNumeric != null ? formatCurrency(bufferCostNumeric) : "—";

  const bufferTimeDisplay =
    bufferTimeNumeric != null ? formatDurationDays(bufferTimeNumeric) : "—";

  const costBufferBarFraction = useMemo(() => {
    if (bufferCostNumeric == null || bufferCostNumeric <= 0) return null;
    const den = Math.max(
      bufferCostNumeric,
      meanCostFromSnapshot ?? 0,
      costAtAppetiteLine ?? 0,
      1
    );
    return bufferCostNumeric / den;
  }, [bufferCostNumeric, meanCostFromSnapshot, costAtAppetiteLine]);

  const timeBufferBarFraction = useMemo(() => {
    if (bufferTimeNumeric == null || bufferTimeNumeric <= 0) return null;
    const den = Math.max(
      bufferTimeNumeric,
      meanTimeFromSnapshot ?? 0,
      timeAtAppetiteLine ?? 0,
      1
    );
    return bufferTimeNumeric / den;
  }, [bufferTimeNumeric, meanTimeFromSnapshot, timeAtAppetiteLine]);

  const ragStatus = useMemo(() => {
    const lastAt = reportingSnapshot?.locked_at ?? reportingSnapshot?.created_at ?? null;
    return computeRag({
      riskCount: countActiveRisks(risks),
      highSeverityCount: countHighSeverityActive(risks),
      lastSimulationAt: lastAt,
    });
  }, [risks, reportingSnapshot?.created_at, reportingSnapshot?.locked_at]);

  const reportingMonthHeader =
    reportingSnapshot?.report_month && formatReportMonthLabel(reportingSnapshot.report_month) !== "—"
      ? formatReportMonthLabel(reportingSnapshot.report_month)
      : null;

  const runDataHref = projectId ? riskaiPath(`/projects/${projectId}/run-data`) : DASHBOARD_PATH;
  const settingsHref = projectId ? riskaiPath(`/projects/${projectId}/settings`) : DASHBOARD_PATH;
  const simulationHref = projectId ? riskaiPath(`/projects/${projectId}/simulation`) : DASHBOARD_PATH;

  /** Mean minus appetite line: ≤0 (at/under target) reads favorable. */
  const gapValueClass = (meanMinusAppetite: number | null) => {
    if (meanMinusAppetite == null || !Number.isFinite(meanMinusAppetite)) {
      return "text-[var(--foreground)]";
    }
    if (meanMinusAppetite <= 0) return "text-emerald-600 dark:text-emerald-400";
    return "text-red-600 dark:text-red-400";
  };

  if (!reportingSnapshot) {
    return (
      <main className="p-6 w-full">
        <div className="mb-6">
          <h1 className="text-lg font-semibold m-0 text-[var(--foreground)]">Project Overview</h1>
        </div>
        <div className="rounded-2xl bg-neutral-100/70 dark:bg-white/[0.06] p-8 text-center shadow-sm">
          <p className="text-base font-medium text-[var(--foreground)] m-0">No reporting run locked</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 m-0 mt-2 max-w-md mx-auto">
            Lock a simulation for reporting to populate this overview. Reporting uses only the latest locked
            run—not draft or unlocked simulations.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={simulationHref}
              className="inline-flex items-center rounded-xl bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-[var(--background)] no-underline hover:opacity-90"
            >
              Go to Simulation
            </Link>
            <Link
              href={runDataHref}
              className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--foreground)] no-underline hover:bg-neutral-200/50 dark:hover:bg-white/10"
            >
              Run Data
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (loadingRisks) {
    return (
      <main className="p-6 w-full">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
      </main>
    );
  }

  const rag = ragPresentation(ragStatus);
  const reportingNoteTrimmed = reportingSnapshot?.lock_note?.trim() ?? "";
  const activeN = countActiveRisks(risks);
  const highN = countHighSeverityActive(risks);

  const targetLabelShort = targetAppetite;

  return (
    <main className="p-6 w-full max-w-7xl mx-auto">
      <header className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-xl font-semibold tracking-tight m-0 text-[var(--foreground)]">
          Project Overview
        </h1>
        <div className="flex flex-col gap-1 text-sm text-neutral-600 dark:text-neutral-300 sm:items-end sm:text-right">
          <p className="m-0">
            <span className="text-neutral-500 dark:text-neutral-400">Reporting run </span>
            <span className="font-medium text-[var(--foreground)]">{reportingMonthHeader ?? "—"}</span>
          </p>
          <div className="m-0 max-w-md sm:max-w-sm">
            <span className="text-neutral-500 dark:text-neutral-400">Note </span>
            {reportingNoteTrimmed ? (
              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                {reportingNoteTrimmed}
              </span>
            ) : (
              <span className="text-neutral-500 dark:text-neutral-400">—</span>
            )}
          </div>
        </div>
      </header>

      {/* Row 1 — headline metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <DashCard>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400 m-0 mb-3">
            Project status
          </p>
          <span
            className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-semibold ${rag.badgeClass}`}
          >
            {rag.label}
          </span>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 m-0 mt-3 tabular-nums">
            {activeN} active risk{activeN === 1 ? "" : "s"}
            {highN > 0 ? ` · ${highN} high / extreme` : ""}
          </p>
        </DashCard>

        <DashCard>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400 m-0 mb-3">
            Target vs current confidence
          </p>
          <p className="text-2xl font-semibold tracking-tight text-[var(--foreground)] m-0 tabular-nums">
            {currentConfidenceLabel ?? "—"}
            <span className="text-neutral-400 dark:text-neutral-500 font-normal mx-2">→</span>
            {targetAppetite}
          </p>
          <div
            className="mt-4 flex items-center gap-2"
            aria-hidden
          >
            <span className="text-[10px] uppercase tracking-wide text-neutral-500 w-14 shrink-0">Current</span>
            <div className="flex flex-1 items-center gap-1.5 min-w-0 max-w-[140px]">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--foreground)] opacity-70" />
              <span className="h-px flex-1 min-w-[12px] bg-[var(--foreground)] opacity-15" />
              <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--foreground)] opacity-35" />
            </div>
            <span className="text-[10px] uppercase tracking-wide text-neutral-500 w-14 shrink-0 text-right">
              Target
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 m-0 mt-3">
            <Link href={settingsHref} className="underline underline-offset-2 hover:text-[var(--foreground)]">
              Settings
            </Link>
          </p>
        </DashCard>

        <DashCard>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400 m-0 mb-2">
            $ gap to target
          </p>
          <p
            className={`text-3xl font-semibold tracking-tight m-0 tabular-nums ${gapValueClass(dollarGapSigned)}`}
          >
            {dollarGapLabel}
          </p>
        </DashCard>

        <DashCard>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400 m-0 mb-2">
            Time gap to target
          </p>
          <p
            className={`text-3xl font-semibold tracking-tight m-0 tabular-nums ${gapValueClass(timeGapSigned)}`}
          >
            {timeGapLabel}
          </p>
        </DashCard>
      </div>

      {/* Row 2 — distributions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-8">
        <DistributionMiniChart
          title="Cost distribution"
          points={costCdfPoints}
          currentX={meanCostFromSnapshot}
          targetX={costAtAppetiteLine}
          targetLabel={targetLabelShort}
          formatX={(n) => formatCurrency(n)}
        />
        <DistributionMiniChart
          title="Time distribution"
          points={timeCdfPoints}
          currentX={meanTimeFromSnapshot}
          targetX={timeAtAppetiteLine}
          targetLabel={targetLabelShort}
          formatX={(n) => formatDurationDays(n)}
        />
      </div>

      {/* Row 3 — buffer */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-8">
        <DashCard>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400 m-0">
            $ contingency remaining
          </p>
          <p className="text-2xl font-semibold tracking-tight text-[var(--foreground)] m-0 mt-2 tabular-nums">
            {bufferCostDisplay}
          </p>
          <BufferBar fraction={costBufferBarFraction} />
        </DashCard>
        <DashCard>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400 m-0">
            Time contingency remaining
          </p>
          <p className="text-2xl font-semibold tracking-tight text-[var(--foreground)] m-0 mt-2 tabular-nums">
            {bufferTimeDisplay}
          </p>
          <BufferBar fraction={timeBufferBarFraction} />
        </DashCard>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <DashCard>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400 m-0 mb-2">
            Key cost risk
          </p>
          <p className="text-sm font-semibold text-[var(--foreground)] m-0 leading-snug line-clamp-3">
            {keyCostRisk ?? "—"}
          </p>
          {keyCostRiskImpact != null ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-300 m-0 mt-2 tabular-nums">
              {formatCurrency(keyCostRiskImpact)} exposure
            </p>
          ) : null}
        </DashCard>
        <DashCard>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400 m-0 mb-2">
            Key time risk
          </p>
          <p className="text-sm font-semibold text-[var(--foreground)] m-0 leading-snug line-clamp-3">
            {keyTimeRisk ?? "—"}
          </p>
          {keyTimeRiskDays != null && keyTimeRiskDays > 0 ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-300 m-0 mt-2 tabular-nums">
              {formatDurationDays(keyTimeRiskDays)} mean
            </p>
          ) : null}
        </DashCard>
        <DashCard>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400 m-0 mb-2">
            Key opportunity
          </p>
          <p className="text-sm font-semibold text-[var(--foreground)] m-0 leading-snug line-clamp-3">
            {keyOpportunityInfo?.name ?? "—"}
          </p>
          {keyOpportunityInfo != null && keyOpportunityInfo.delta > 0 ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-300 m-0 mt-2 tabular-nums">
              {formatCurrency(keyOpportunityInfo.delta)} pre vs modelled
            </p>
          ) : null}
        </DashCard>
      </div>
    </main>
  );
}
