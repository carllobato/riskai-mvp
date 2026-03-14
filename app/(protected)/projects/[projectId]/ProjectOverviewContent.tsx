"use client";

import { useMemo, useEffect, useState } from "react";
import { useRiskRegister } from "@/store/risk-register.store";
import { listRisks } from "@/lib/db/risks";
import { computePortfolioExposure } from "@/engine/forwardExposure";
import { SummaryTile } from "@/components/dashboard/SummaryTile";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ForecastSummaryCard } from "@/components/dashboard/ForecastSummaryCard";
import { RankedRiskList } from "@/components/dashboard/RankedRiskList";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { formatCurrency, formatRatio } from "@/lib/formatCurrency";
import { formatDurationDays } from "@/lib/formatDuration";
import { loadProjectContext } from "@/lib/projectContext";
import type { Risk } from "@/domain/risk/risk.schema";
import type { SimulationSnapshotRow } from "@/lib/db/snapshots";

export type ProjectOverviewInitialData = {
  projectId: string;
  projectName: string;
  riskCount: number;
  latestSnapshot: SimulationSnapshotRow | null;
};

type ProjectOverviewContentProps = {
  initialData: ProjectOverviewInitialData;
};

function formatSnapshotDate(iso: string | undefined): string {
  if (!iso) return "Not available";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "Not available";
  }
}

/** Derive P80 from P50 and P90 when not stored (e.g. DB only has P10, P50, P90). */
function p80FromP50P90(p50: number, p90: number): number {
  return (p50 + p90) / 2;
}

export function ProjectOverviewContent({ initialData }: ProjectOverviewContentProps) {
  const { projectId, projectName, riskCount, latestSnapshot } = initialData ?? {
    projectId: "",
    projectName: "",
    riskCount: 0,
    latestSnapshot: null,
  };
  const { setRisks } = useRiskRegister();
  const [risks, setRisksLocal] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    listRisks(projectId)
      .then((loaded) => {
        setRisks(loaded);
        setRisksLocal(loaded);
      })
      .catch((err) => console.error("[ProjectOverview] load risks", err))
      .finally(() => setLoading(false));
    // Intentionally depend only on projectId; setRisks identity changes when store updates and would cause a re-fetch loop / crash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const exposure = useMemo(() => {
    if (risks.length === 0) return null;
    return computePortfolioExposure(risks, "neutral", 12, { topN: 5 });
  }, [risks]);

  const highSeverityCount = useMemo(() => {
    return risks.filter(
      (r) => r.residualRating?.level === "high" || r.residualRating?.level === "extreme"
    ).length;
  }, [risks]);

  const costPercentiles = useMemo(() => {
    const row = latestSnapshot;
    if (!row || typeof row !== "object") return [];
    const p10 = Number(row.p10_cost) ?? 0;
    const p50 = Number(row.p50_cost) ?? 0;
    const p90 = Number(row.p90_cost) ?? 0;
    const p80 = p80FromP50P90(p50, p90);
    return [
      { label: "P10", value: formatCurrency(p10) },
      { label: "P50", value: formatCurrency(p50) },
      { label: "P80", value: formatCurrency(p80) },
      { label: "P90", value: formatCurrency(p90) },
    ];
  }, [latestSnapshot]);

  const schedulePercentiles = useMemo(() => {
    const row = latestSnapshot;
    if (!row || typeof row !== "object") return [];
    const p10 = Number(row.p10_time) ?? 0;
    const p50 = Number(row.p50_time) ?? 0;
    const p90 = Number(row.p90_time) ?? 0;
    const p80 = p80FromP50P90(p50, p90);
    return [
      { label: "P10", value: formatDurationDays(p10) },
      { label: "P50", value: formatDurationDays(p50) },
      { label: "P80", value: formatDurationDays(p80) },
      { label: "P90", value: formatDurationDays(p90) },
    ];
  }, [latestSnapshot]);

  const topCostRisks = useMemo(() => {
    if (!exposure?.topDrivers?.length) return [];
    return exposure.topDrivers.slice(0, 5).map((d) => {
      const risk = risks.find((r) => r.id === d.riskId);
      return {
        id: d.riskId,
        title: risk?.title ?? d.riskId,
        ownerOrCategory: risk?.owner ?? risk?.category ?? d.category,
        value: d.total,
        status: risk?.status,
      };
    });
  }, [exposure, risks]);

  const topScheduleRisks = useMemo(() => {
    const withDays = risks
      .map((r) => {
        const days =
          r.scheduleImpactDays ??
          r.postMitigationTimeML ??
          r.preMitigationTimeML ??
          0;
        return { risk: r, days };
      })
      .filter((x) => x.days > 0)
      .sort((a, b) => b.days - a.days)
      .slice(0, 5);
    return withDays.map(({ risk, days }) => ({
      id: risk.id,
      title: risk.title,
      ownerOrCategory: risk.owner ?? risk.category ?? "—",
      days,
      status: risk.status,
    }));
  }, [risks]);

  const registerCounts = useMemo(() => {
    const open = risks.filter((r) => r.status === "open").length;
    const high = risks.filter(
      (r) => r.residualRating?.level === "high" || r.residualRating?.level === "extreme"
    ).length;
    const mitigated = risks.filter((r) => (r.mitigation?.trim()?.length ?? 0) > 0).length;
    const closed = risks.filter((r) => r.status === "closed" || r.status === "archived").length;
    return { open, high, mitigated, closed };
  }, [risks]);

  const residualExposure = exposure?.total ?? 0;
  const totalScheduleExposureDays = useMemo(() => {
    return risks.reduce((sum, r) => {
      const days =
        r.scheduleImpactDays ??
        r.postMitigationTimeML ??
        r.preMitigationTimeML ??
        0;
      return sum + (Number.isFinite(days) ? days : 0);
    }, 0);
  }, [risks]);
  const projectContext = useMemo(
    () => (projectId ? loadProjectContext(projectId) : null),
    [projectId]
  );
  const contingencyHeld: number | null =
    projectContext?.contingencyValue_m != null &&
    Number.isFinite(projectContext.contingencyValue_m)
      ? projectContext.contingencyValue_m * 1e6
      : null;
  const coverageRatio =
    contingencyHeld != null && residualExposure > 0 ? contingencyHeld / residualExposure : null;

  const lastRunDate = latestSnapshot?.created_at;
  const lastRunIterations = latestSnapshot?.iterations;

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading overview…</p>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      {/* Section A — Project Health Summary: 6 tiles */}
      <section className="mb-8" aria-labelledby="project-health-heading">
        <h2 id="project-health-heading" className="sr-only">
          Project health summary
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <SummaryTile
            title="Risks"
            primaryValue={String(riskCount)}
            subtext={highSeverityCount > 0 ? `${highSeverityCount} high severity` : undefined}
          />
          <SummaryTile
            title="Residual Risk Exposure"
            primaryValue={exposure ? formatCurrency(residualExposure) : "Not available"}
            subtext="Aggregated current project exposure"
          />
          <SummaryTile
            title="Residual Time Exposure"
            primaryValue={
              risks.length > 0 && totalScheduleExposureDays > 0
                ? formatDurationDays(totalScheduleExposureDays)
                : "Not available"
            }
            subtext="Aggregated current schedule exposure"
          />
          <SummaryTile
            title="Contingency Held"
            primaryValue={
              contingencyHeld != null ? formatCurrency(contingencyHeld) : "Not available"
            }
            subtext="Available contingency allowance"
          />
          <SummaryTile
            title="Coverage Ratio"
            primaryValue={
              coverageRatio != null ? formatRatio(coverageRatio) : "Not available"
            }
            subtext="Protection level"
          />
          <SummaryTile
            title="Last Simulation Run"
            primaryValue={formatSnapshotDate(lastRunDate)}
            subtext={
              lastRunIterations != null && Number.isFinite(lastRunIterations)
                ? `${lastRunIterations.toLocaleString()} iterations`
                : undefined
            }
          />
        </div>
      </section>

      {/* Section B — Forecast Summary: Cost and Schedule */}
      <section className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6" aria-labelledby="forecast-heading">
        <h2 id="forecast-heading" className="sr-only">
          Forecast summary
        </h2>
        <ForecastSummaryCard
          title="Cost Forecast"
          percentiles={costPercentiles}
          emptyMessage="No simulation run yet. Run simulation on the Run Data page."
        />
        <ForecastSummaryCard
          title="Schedule Forecast"
          percentiles={schedulePercentiles}
          emptyMessage="No simulation run yet. Run simulation on the Run Data page."
        />
      </section>

      {/* Section C — Key Risk Drivers */}
      <section className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6" aria-labelledby="drivers-heading">
        <h2 id="drivers-heading" className="sr-only">
          Key risk drivers
        </h2>
        <DashboardCard title="Top 5 Cost Risks">
          {topCostRisks.length === 0 ? (
            <EmptyState message="No cost drivers. Add risks and run simulation or use Run Data for exposure." />
          ) : (
            <RankedRiskList
              items={topCostRisks}
              renderRow={(item) => (
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate m-0">
                      {item.title}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 m-0">
                      {item.ownerOrCategory}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {formatCurrency(item.value)}
                    </span>
                    {item.status != null && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-300">
                        {item.status}
                      </span>
                    )}
                  </div>
                </div>
              )}
            />
          )}
        </DashboardCard>
        <DashboardCard title="Top 5 Schedule Risks">
          {topScheduleRisks.length === 0 ? (
            <EmptyState message="No schedule impact data. Add schedule impact (days) to risks." />
          ) : (
            <RankedRiskList
              items={topScheduleRisks}
              renderRow={(item) => (
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate m-0">
                      {item.title}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 m-0">
                      {item.ownerOrCategory}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {item.days} days
                    </span>
                    {item.status != null && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-300">
                        {item.status}
                      </span>
                    )}
                  </div>
                </div>
              )}
            />
          )}
        </DashboardCard>
      </section>

      {/* Section D — Risk Register Snapshot */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-labelledby="register-heading">
        <h2 id="register-heading" className="sr-only">
          Risk register snapshot
        </h2>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 m-0 mb-1">
            Open Risks
          </p>
          <p className="text-2xl font-semibold text-[var(--foreground)] m-0">
            {registerCounts.open}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 m-0 mb-1">
            High Risks
          </p>
          <p className="text-2xl font-semibold text-[var(--foreground)] m-0">
            {registerCounts.high}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 m-0 mb-1">
            Mitigated Risks
          </p>
          <p className="text-2xl font-semibold text-[var(--foreground)] m-0">
            {registerCounts.mitigated}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 m-0 mb-1">
            Closed Risks
          </p>
          <p className="text-2xl font-semibold text-[var(--foreground)] m-0">
            {registerCounts.closed}
          </p>
        </div>
      </section>
    </main>
  );
}
