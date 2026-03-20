"use client";

import { useMemo, useEffect, useState } from "react";
import { useRiskRegister } from "@/store/risk-register.store";
import { listRisks } from "@/lib/db/risks";
import { computePortfolioExposure } from "@/engine/forwardExposure";
import { PositionBar } from "@/components/dashboard/PositionBar";
import { SummaryTile } from "@/components/dashboard/SummaryTile";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
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

export function ProjectOverviewContent({ initialData }: ProjectOverviewContentProps) {
  const { projectId, riskCount, latestSnapshot } = initialData ?? {
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

  const costPosition = useMemo(() => {
    const row = latestSnapshot;
    if (!row || typeof row !== "object") return null;
    const p10 = Number(row.p10_cost) ?? 0;
    const p50 = Number(row.p50_cost) ?? 0;
    const p90 = Number(row.p90_cost) ?? 0;
    return { p10, p50, p90 };
  }, [latestSnapshot]);

  const schedulePosition = useMemo(() => {
    const row = latestSnapshot;
    if (!row || typeof row !== "object") return null;
    const p10 = Number(row.p10_time) ?? 0;
    const p50 = Number(row.p50_time) ?? 0;
    const p90 = Number(row.p90_time) ?? 0;
    return { p10, p50, p90 };
  }, [latestSnapshot]);

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

  const targetLabel = projectContext?.riskAppetite ?? "P80";
  const targetMet = coverageRatio != null && coverageRatio >= 1;
  const targetStatus = coverageRatio == null ? null : targetMet ? "Met" : "Below recommended";

  const verdict = useMemo(() => {
    if (highSeverityCount > 0 && (coverageRatio == null || coverageRatio < 1))
      return { label: "Review recommended", support: "Exposure exceeds contingency or high-severity risks present.", tone: "amber" as const };
    if (riskCount === 0)
      return { label: "No risks yet", support: "Add risks and run simulation to see verdict.", tone: "neutral" as const };
    return {
      label: "Controlled",
      support: `Project is operating within recommended confidence (${projectContext?.riskAppetite ?? "P80"}).`,
      tone: "emerald" as const,
    };
  }, [highSeverityCount, coverageRatio, riskCount, projectContext?.riskAppetite]);

  const scheduleBufferDays =
    projectContext?.scheduleContingency_weeks != null && Number.isFinite(projectContext.scheduleContingency_weeks)
      ? projectContext.scheduleContingency_weeks * 7
      : null;

  if (loading) {
    return (
      <main className="p-6 max-w-6xl mx-auto w-full">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-lg font-semibold m-0 text-[var(--foreground)]">Project Overview</h2>
      </div>

      {/* Verdict strip — simulation-style baseline panel */}
      <section
        className="rounded-lg bg-neutral-50 dark:bg-neutral-800/50 overflow-hidden"
        aria-labelledby="verdict-heading"
      >
        <div className="py-3 px-4 bg-[var(--background)]">
          <h2 id="verdict-heading" className="sr-only">
            Project verdict
          </h2>
          <p
            className={`text-xl font-semibold tracking-tight m-0 ${
              verdict.tone === "emerald"
                ? "text-emerald-700 dark:text-emerald-400"
                : verdict.tone === "amber"
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-[var(--foreground)]"
            }`}
          >
            {verdict.label}
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 m-0 mt-0.5">
            {verdict.support}
          </p>
        </div>
      </section>

      {/* Metric tiles row — same layout as Simulation baseline */}
      <section
        className="mt-0 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 overflow-hidden"
        aria-labelledby="metrics-heading"
      >
        <div className="py-3 px-4 bg-[var(--background)]">
          <h2 id="metrics-heading" className="sr-only">
            Core metrics
          </h2>
          <div className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <SummaryTile
              title="Residual Cost"
              primaryValue={exposure ? formatCurrency(residualExposure) : "—"}
            />
            <SummaryTile
              title="Residual Schedule"
              primaryValue={
                risks.length > 0 && totalScheduleExposureDays > 0
                  ? formatDurationDays(totalScheduleExposureDays)
                  : "—"
              }
            />
            <SummaryTile
              title="Contingency"
              primaryValue={contingencyHeld != null ? formatCurrency(contingencyHeld) : "—"}
            />
            <SummaryTile
              title="Coverage"
              primaryValue={coverageRatio != null ? formatRatio(coverageRatio) : "—"}
            />
            <SummaryTile
              title="Target"
              primaryValue={
                projectContext
                  ? `${targetLabel}${targetStatus != null ? ` (${targetStatus})` : ""}`
                  : "—"
              }
            />
          </div>
        </div>
      </section>

      {/* Position bars in cards — same two-column layout as Simulation */}
      <section
        className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6"
        aria-labelledby="position-heading"
      >
        <h2 id="position-heading" className="sr-only">
          Cost and schedule position
        </h2>
        <DashboardCard title="Cost">
          {costPosition ? (
            <PositionBar
              label="Cost"
              p10={costPosition.p10}
              p50={costPosition.p50}
              p90={costPosition.p90}
              formatValue={formatCurrency}
              valueLabel="P50"
              currentPosition={contingencyHeld}
            />
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 m-0">
              No simulation run yet. Run simulation on Run Data.
            </p>
          )}
        </DashboardCard>
        <DashboardCard title="Schedule">
          {schedulePosition ? (
            <PositionBar
              label="Schedule"
              p10={schedulePosition.p10}
              p50={schedulePosition.p50}
              p90={schedulePosition.p90}
              formatValue={formatDurationDays}
              valueLabel="P50"
              currentPosition={scheduleBufferDays}
            />
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 m-0">
              No simulation run yet. Run simulation on Run Data.
            </p>
          )}
        </DashboardCard>
      </section>

      {/* Footer */}
      <footer className="mt-8 pt-4 border-t border-neutral-200 dark:border-neutral-700">
        <p className="text-sm text-neutral-500 dark:text-neutral-400 m-0">
          Based on latest reporting run · Synced with Run Data
        </p>
      </footer>
    </main>
  );
}
