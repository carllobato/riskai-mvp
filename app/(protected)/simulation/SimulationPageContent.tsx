"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRiskRegister } from "@/store/risk-register.store";
import { getLatestSnapshot } from "@/lib/db/snapshots";
import { listRisks, DEFAULT_PROJECT_ID } from "@/lib/db/risks";
import {
  getNeutralSummary,
  getNeutralSamples,
  getNeutralTimeSamples,
  getNeutralTimeSummary,
} from "@/store/selectors";
import { loadProjectContext, formatMoneyMillions, isProjectContextComplete } from "@/lib/projectContext";
import { formatDurationDays } from "@/lib/formatDuration";
import {
  distributionToCostCdf,
  distributionToTimeCdf,
  binSamplesIntoHistogram,
  binSamplesIntoTimeHistogram,
  deriveCostHistogramFromPercentiles,
  deriveTimeHistogramFromPercentiles,
  type CostCdfPoint,
  type TimeCdfPoint,
} from "@/lib/simulationDisplayUtils";
import {
  SimulationSection,
  type SimulationSectionBaseline,
  type CostResults,
  type TimeResults,
} from "@/components/simulation/SimulationSection";
import type { SimulationRiskSnapshot } from "@/domain/simulation/simulation.types";

const DISTRIBUTION_BIN_COUNT = 28;

/** Stable empty array for snapshot risks to avoid new [] identity every render. */
const EMPTY_SNAPSHOT_RISKS: SimulationRiskSnapshot[] = [];

function formatDash<T>(value: T | undefined | null, formatter: (v: T) => string): string {
  if (value == null || (typeof value === "number" && !Number.isFinite(value))) return "—";
  return formatter(value as T);
}

/** Parse risk appetite e.g. "P80" -> 80. */
function riskAppetiteToPercent(riskAppetite: string): number {
  const n = parseInt(riskAppetite.replace(/^P/, ""), 10);
  return Number.isFinite(n) ? n : 50;
}

function MetricTile({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 p-3 transition-colors hover:border-neutral-300 dark:hover:border-neutral-600">
      <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold text-[var(--foreground)]">{value}</div>
      {helper && (
        <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{helper}</div>
      )}
    </div>
  );
}

const ACTIVE_PROJECT_KEY = "activeProjectId";

export type SimulationPageProps = { projectId?: string | null };

/** After load: we know whether this project has a snapshot. Only show results when hasSnapshot is true. */
type SnapshotState = { projectId: string; hasSnapshot: boolean } | null;

export default function SimulationPage({ projectId: urlProjectId }: SimulationPageProps = {}) {
  const router = useRouter();
  const { risks, simulation, runSimulation, clearSimulationHistory, hasDraftRisks, invalidRunnableCount, setRisks, hydrateSimulationFromDbSnapshot } = useRiskRegister();
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [runBlockedInvalidCount, setRunBlockedInvalidCount] = useState<number | null>(null);
  const [projectContext, setProjectContext] = useState<ReturnType<typeof loadProjectContext>>(null);
  const [gateChecked, setGateChecked] = useState(false);
  /** If non-null and projectId matches current project: hasSnapshot true = show results, false = show Run simulation only. */
  const [snapshotForProject, setSnapshotForProject] = useState<SnapshotState>(null);
  const effectiveProjectIdRef = useRef<string | undefined>(undefined);
  const hydrateRef = useRef(hydrateSimulationFromDbSnapshot);
  hydrateRef.current = hydrateSimulationFromDbSnapshot;
  const clearRef = useRef(clearSimulationHistory);
  clearRef.current = clearSimulationHistory;
  const setRisksRef = useRef(setRisks);
  setRisksRef.current = setRisks;

  const [activeProjectIdFromStorage, setActiveProjectIdFromStorage] = useState<string | null>(null);
  /** UUID for DB/API: URL or storage when in project routes; in legacy mode use DEFAULT_PROJECT_ID (projectContext.projectName is a display name, not a UUID). */
  const effectiveProjectId = urlProjectId ?? activeProjectIdFromStorage ?? (projectContext ? DEFAULT_PROJECT_ID : undefined);
  effectiveProjectIdRef.current = effectiveProjectId;

  useEffect(() => {
    if (invalidRunnableCount === 0) setRunBlockedInvalidCount(null);
  }, [invalidRunnableCount]);
  const setupRedirectPath = urlProjectId ? `/projects/${urlProjectId}` : "/";

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setActiveProjectIdFromStorage(window.localStorage.getItem(ACTIVE_PROJECT_KEY));
    } catch {
      // localStorage unavailable (e.g. private browsing)
    }
  }, []);

  // Gate: redirect to setup only in legacy mode (no urlProjectId). When accessing via URL, global context is not required.
  useEffect(() => {
    const ctx = loadProjectContext();
    setProjectContext(ctx);
    setGateChecked(true);
  }, []);
  useEffect(() => {
    if (!gateChecked) return;
    if (urlProjectId) return;
    if (!isProjectContextComplete(projectContext)) {
      router.replace(setupRedirectPath);
      return;
    }
  }, [gateChecked, projectContext, router, setupRedirectPath, urlProjectId]);

  // When project changes: clear store, then load risks + snapshot for this project. Only show results if snapshot exists for this project.
  useEffect(() => {
    if (!gateChecked) return;
    if (!isProjectContextComplete(projectContext) && !urlProjectId) return;
    if (!effectiveProjectId) return;
    setLastRun(null);
    setSnapshotForProject(null);
    clearRef.current();
    const projectIdWeAreLoading = effectiveProjectId;
    listRisks(projectIdWeAreLoading)
      .then((loaded) => {
        if (effectiveProjectIdRef.current !== projectIdWeAreLoading) return;
        setRisksRef.current(loaded);
      })
      .catch((err) => console.error("[simulation] load risks", err));
    getLatestSnapshot(projectIdWeAreLoading)
      .then((snapshot) => {
        if (effectiveProjectIdRef.current !== projectIdWeAreLoading) return;
        const hasSnapshot = !!(snapshot?.created_at);
        setSnapshotForProject({ projectId: projectIdWeAreLoading, hasSnapshot });
        if (hasSnapshot && snapshot) {
          setLastRun(snapshot.created_at ?? null);
          hydrateRef.current(snapshot);
        }
      })
      .catch((err) => {
        if (effectiveProjectIdRef.current !== projectIdWeAreLoading) return;
        setSnapshotForProject({ projectId: projectIdWeAreLoading, hasSnapshot: false });
        console.error("[simulation] load snapshot", err);
      });
  }, [gateChecked, projectContext, urlProjectId, effectiveProjectId]);

  const analysisState = useMemo(
    () => ({ risks, simulation: { ...simulation } }),
    [risks, simulation]
  );

  const neutralSummary = useMemo(() => getNeutralSummary(analysisState), [analysisState]);
  const costSamples = useMemo(() => getNeutralSamples(analysisState), [analysisState]);
  const timeSamples = useMemo(() => getNeutralTimeSamples(analysisState), [analysisState]);
  const timeSummary = useMemo(() => getNeutralTimeSummary(analysisState), [analysisState]);

  const iterationCount = simulation.neutral?.iterationCount ?? 0;
  const snapshotRisks = simulation.current?.risks ?? EMPTY_SNAPSHOT_RISKS;

  const hasData = neutralSummary != null;
  /** Only show results when we've loaded for this project and it has a snapshot; else show Run simulation. Legacy: no effectiveProjectId but hasSnapshot. */
  const currentProjectHasSnapshot =
    (snapshotForProject?.projectId === effectiveProjectId && snapshotForProject?.hasSnapshot) ||
    (effectiveProjectId == null && (snapshotForProject?.hasSnapshot ?? false));
  const showResults = currentProjectHasSnapshot && hasData;
  const showRunOnly =
    (snapshotForProject?.projectId === effectiveProjectId && !snapshotForProject?.hasSnapshot) ||
    (effectiveProjectId == null && !(snapshotForProject?.hasSnapshot ?? false));
  const loadingSnapshot = effectiveProjectId != null && snapshotForProject?.projectId !== effectiveProjectId;

  // Prefer project-specific context for display; fall back to gate (global) context
  const displayContext = useMemo(
    () => loadProjectContext(effectiveProjectId ?? null) ?? projectContext,
    [effectiveProjectId, projectContext]
  );

  const baseline: SimulationSectionBaseline | null = useMemo(() => {
    const targetPNumeric = displayContext
      ? riskAppetiteToPercent(displayContext.riskAppetite)
      : 80;
    const targetPLabel = displayContext?.riskAppetite ?? "P80";
    return {
      targetPNumeric,
      targetPLabel,
      approvedValue: 0,
    };
  }, [displayContext]);

  const costCdf = useMemo((): CostCdfPoint[] | null => {
    if (!hasData) return null;
    if (costSamples != null && costSamples.length > 0) {
      const dist = binSamplesIntoHistogram(costSamples, DISTRIBUTION_BIN_COUNT);
      return distributionToCostCdf(dist);
    }
    if (neutralSummary) {
      const dist = deriveCostHistogramFromPercentiles(
        {
          p20Cost: neutralSummary.p20Cost,
          p50Cost: neutralSummary.p50Cost,
          p80Cost: neutralSummary.p80Cost,
          p90Cost: neutralSummary.p90Cost,
        },
        DISTRIBUTION_BIN_COUNT
      );
      return distributionToCostCdf(dist);
    }
    return null;
  }, [hasData, costSamples, neutralSummary]);

  const timeCdf = useMemo((): TimeCdfPoint[] | null => {
    if (!timeSummary) return null;
    if (timeSamples != null && timeSamples.length > 0) {
      const dist = binSamplesIntoTimeHistogram(timeSamples, DISTRIBUTION_BIN_COUNT);
      return distributionToTimeCdf(dist);
    }
    const dist = deriveTimeHistogramFromPercentiles(timeSummary, DISTRIBUTION_BIN_COUNT);
    return distributionToTimeCdf(dist);
  }, [timeSummary, timeSamples]);

  const approvedBudgetBase = useMemo(() => {
    if (!displayContext) return null;
    return displayContext.approvedBudget_m * 1e6;
  }, [displayContext]);

  const plannedDurationDays = useMemo(() => {
    if (!displayContext) return null;
    return (displayContext.plannedDuration_months * 365) / 12;
  }, [displayContext]);

  const contingencyDays = useMemo(() => {
    if (!displayContext?.scheduleContingency_weeks) return null;
    return displayContext.scheduleContingency_weeks * 7;
  }, [displayContext]);

  const costBaseline: SimulationSectionBaseline | null = useMemo(() => {
    if (!baseline) return null;
    return { ...baseline, approvedValue: approvedBudgetBase ?? 0 };
  }, [baseline, approvedBudgetBase]);

  const timeBaseline: SimulationSectionBaseline | null = useMemo(() => {
    if (!baseline) return null;
    return { ...baseline, approvedValue: plannedDurationDays ?? 0 };
  }, [baseline, plannedDurationDays]);

  const costResults: CostResults = useMemo(
    () => ({
      samples: costSamples ?? null,
      summary: neutralSummary
        ? {
            p20Cost: neutralSummary.p20Cost,
            p50Cost: neutralSummary.p50Cost,
            p80Cost: neutralSummary.p80Cost,
            p90Cost: neutralSummary.p90Cost,
          }
        : null,
      iterationCount,
      risks: snapshotRisks,
    }),
    [costSamples, neutralSummary, iterationCount, snapshotRisks]
  );

  const timeResults: TimeResults = useMemo(
    () => ({
      samples: timeSamples ?? null,
      summary: timeSummary,
      iterationCount,
      risks: snapshotRisks,
    }),
    [timeSamples, timeSummary, iterationCount, snapshotRisks]
  );

  return (
    <main className="p-6">
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold m-0 text-[var(--foreground)]">Simulation</h2>
          <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={async () => {
            try {
              const result = await runSimulation(10000, effectiveProjectId ?? undefined);
              if (!result.ran && result.blockReason === "invalid") {
                setRunBlockedInvalidCount(result.invalidCount);
                return;
              }
              if (result.ran) {
                const now = new Date().toISOString();
                setLastRun(now);
                setSnapshotForProject({
                  projectId: effectiveProjectId ?? "legacy",
                  hasSnapshot: true,
                });
              }
            } catch {
              // Snapshot insert failed; do not update timestamp
            }
          }}
          disabled={hasDraftRisks || invalidRunnableCount > 0}
          className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          Run Simulation
        </button>
        <button
          type="button"
          onClick={clearSimulationHistory}
          className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
        >
          Clear History
        </button>
        </div>
      </div>
      </div>
      {hasDraftRisks && (
        <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 text-right" role="status">
          Review and save all draft risks in the Risk Register before running simulation.
        </p>
      )}
      {invalidRunnableCount > 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 text-right" role="status">
          Fix {invalidRunnableCount} risk{invalidRunnableCount !== 1 ? "s" : ""} to run simulation.
        </p>
      )}
      {runBlockedInvalidCount != null && runBlockedInvalidCount > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-300 font-medium mt-2" role="alert">
          Simulation blocked: fix {runBlockedInvalidCount} risk{runBlockedInvalidCount !== 1 ? "s" : ""} to run simulation.
        </p>
      )}

      {loadingSnapshot && (
        <div className="mt-0 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-6 text-center">
          <p className="text-[var(--foreground)] font-medium m-0">Loading simulation data…</p>
        </div>
      )}

      {showRunOnly && (
        <div className="mt-0 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-6 text-center">
          <p className="text-[var(--foreground)] font-medium m-0">
            No simulation run for this project yet. Run a simulation to see results.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={async () => {
                try {
                  const result = await runSimulation(10000, effectiveProjectId ?? undefined);
                  if (!result.ran && result.blockReason === "invalid") {
                    setRunBlockedInvalidCount(result.invalidCount);
                    return;
                  }
                  if (result.ran) {
                    const now = new Date().toISOString();
                    setLastRun(now);
                    setSnapshotForProject({
                      projectId: effectiveProjectId ?? "legacy",
                      hasSnapshot: true,
                    });
                  }
                } catch {
                  // Snapshot insert failed; do not update timestamp
                }
              }}
              disabled={hasDraftRisks || invalidRunnableCount > 0}
              className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              Run simulation
            </button>
            {effectiveProjectId && (
              <Link
                href={`/projects/${effectiveProjectId}/outputs`}
                className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors no-underline text-[var(--foreground)]"
              >
                Go to Outputs
              </Link>
            )}
          </div>
        </div>
      )}

      {showResults && (
        <>
          {/* Baseline — compact row with header */}
          <section className="mt-0 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 overflow-hidden">
            <div className="py-3 bg-white dark:bg-neutral-900">
              <div className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <MetricTile
                  label="Base value"
                  value={formatDash(displayContext?.projectValue_m, (m) => formatMoneyMillions(m))}
                  helper="Base value"
                />
                <MetricTile
                  label="Contingency Value ($)"
                  value={formatDash(displayContext?.contingencyValue_m, (m) => formatMoneyMillions(m))}
                  helper="Contingency budget"
                />
                <MetricTile
                  label="Duration"
                  value={formatDash(plannedDurationDays, formatDurationDays)}
                  helper="Planned schedule duration"
                />
                <MetricTile
                  label="Contingency Value (Days)"
                  value={contingencyDays != null ? `${Math.round(contingencyDays)} days` : "—"}
                  helper="Schedule contingency"
                />
                <MetricTile
                  label="Target P-Value"
                  value={displayContext?.riskAppetite ?? "—"}
                  helper="Risk appetite percentile"
                />
              </div>
            </div>
          </section>

          {/* Group 2 & 3 — Cost (left) and Schedule (right) side by side */}
          <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {costBaseline && (
              <SimulationSection
                title="Cost Simulation"
                mode="cost"
                baseline={costBaseline}
                results={costResults}
                costCdf={costCdf}
                formatCostValue={displayContext ? (dollars) => formatMoneyMillions(dollars / 1e6) : undefined}
                contingencyValueDollars={displayContext ? displayContext.contingencyValue_m * 1e6 : undefined}
                settingsHref={effectiveProjectId ? `/projects/${effectiveProjectId}/settings` : undefined}
              />
            )}
            {timeBaseline && (
              <SimulationSection
                title="Schedule Simulation"
                mode="time"
                baseline={timeBaseline}
                results={timeResults}
                timeCdf={timeCdf}
                settingsHref={effectiveProjectId ? `/projects/${effectiveProjectId}/settings` : undefined}
              />
            )}
          </section>
        </>
      )}

      {currentProjectHasSnapshot && lastRun && (
        <footer className="mt-8 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-sm text-neutral-500 dark:text-neutral-400 m-0">
            Last simulation run: {new Date(lastRun).toLocaleString()}
          </p>
        </footer>
      )}
    </main>
  );
}
