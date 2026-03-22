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
import { isRiskStatusArchived } from "@/domain/risk/riskFieldSemantics";

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

  const activeRisks = useMemo(
    () => risks.filter((r) => !isRiskStatusArchived(r.status)),
    [risks]
  );

  const exposure = useMemo(() => {
    if (activeRisks.length === 0) return null;
    return computePortfolioExposure(activeRisks, "neutral", 12, { topN: 5 });
  }, [activeRisks]);

  const highSeverityCount = useMemo(() => {
    return activeRisks.filter(
      (r) => r.residualRating?.level === "high" || r.residualRating?.level === "extreme"
    ).length;
  }, [activeRisks]);

  const costPosition = useMemo(() => {
    const row = latestSnapshot;
    if (!row || typeof row !== "object") return null;
    const p50 = Number(row.cost_p50);
    const p50Safe = Number.isFinite(p50) ? p50 : 0;
    const minCol = row.cost_min;
    const maxCol = row.cost_max;
    const hasMinMax =
      minCol != null &&
      maxCol != null &&
      Number.isFinite(Number(minCol)) &&
      Number.isFinite(Number(maxCol));
    let minBound = hasMinMax ? Number(minCol) : Number(row.cost_p20);
    let maxBound = hasMinMax ? Number(maxCol) : Number(row.cost_p90);
    if (!Number.isFinite(minBound)) minBound = 0;
    if (!Number.isFinite(maxBound)) maxBound = 0;
    if (minBound > maxBound) [minBound, maxBound] = [maxBound, minBound];
    return { p10: minBound, p50: p50Safe, p90: maxBound };
  }, [latestSnapshot]);

  const schedulePosition = useMemo(() => {
    const row = latestSnapshot;
    if (!row || typeof row !== "object") return null;
    const p50 = Number(row.time_p50);
    const p50Safe = Number.isFinite(p50) ? p50 : 0;
    const minCol = row.time_min;
    const maxCol = row.time_max;
    const hasMinMax =
      minCol != null &&
      maxCol != null &&
      Number.isFinite(Number(minCol)) &&
      Number.isFinite(Number(maxCol));
    let minBound = hasMinMax ? Number(minCol) : Number(row.time_p20);
    let maxBound = hasMinMax ? Number(maxCol) : Number(row.time_p90);
    if (!Number.isFinite(minBound)) minBound = 0;
    if (!Number.isFinite(maxBound)) maxBound = 0;
    if (minBound > maxBound) [minBound, maxBound] = [maxBound, minBound];
    return { p10: minBound, p50: p50Safe, p90: maxBound };
  }, [latestSnapshot]);

  const residualExposure = exposure?.total ?? 0;
  const totalScheduleExposureDays = useMemo(() => {
    return activeRisks.reduce((sum, r) => {
      const days = r.preMitigationTimeML ?? r.postMitigationTimeML ?? 0;
      return sum + (Number.isFinite(days) ? days : 0);
    }, 0);
  }, [activeRisks]);

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
    if (riskCount === 0 || activeRisks.length === 0)
      return {
        label: "No risks yet",
        support:
          risks.length > 0 && activeRisks.length === 0
            ? "All risks are archived. Restore from the risk register Archived tab if needed."
            : "Add risks and run simulation to see verdict.",
        tone: "neutral" as const,
      };
    return {
      label: "Controlled",
      support: `Project is operating within recommended confidence (${projectContext?.riskAppetite ?? "P80"}).`,
      tone: "emerald" as const,
    };
  }, [highSeverityCount, coverageRatio, riskCount, projectContext?.riskAppetite, risks.length, activeRisks.length]);

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

      <div className="flex flex-col gap-3">
      {/* Verdict + core metrics — single panel */}
      <section
        className="rounded-lg bg-neutral-50 dark:bg-neutral-800/50 overflow-hidden"
        aria-labelledby="verdict-heading metrics-heading"
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
        <div className="bg-[var(--background)] py-3 px-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <h2 id="metrics-heading" className="sr-only col-span-full">
            Core metrics
          </h2>
          <SummaryTile
            title="Residual Cost"
            primaryValue={exposure ? formatCurrency(residualExposure) : "—"}
          />
          <SummaryTile
            title="Residual Schedule"
            primaryValue={
              activeRisks.length > 0 && totalScheduleExposureDays > 0
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
      </section>

      {/* Position bars in cards — same two-column layout as Simulation */}
      <section
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
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
      </div>

      {/* Footer */}
      <footer className="mt-8 pt-4 border-t border-neutral-200 dark:border-neutral-700">
        <p className="text-sm text-neutral-500 dark:text-neutral-400 m-0">
          Based on latest reporting run · Synced with Run Data
        </p>
      </footer>
    </main>
  );
}
