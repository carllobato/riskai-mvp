"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRiskRegister } from "@/store/risk-register.store";
import {
  getLatestSnapshot,
  setSnapshotAsReportingVersion,
  type SimulationSnapshotRow,
  type SimulationSnapshotRowDb,
} from "@/lib/db/snapshots";
import { listRisks, DEFAULT_PROJECT_ID } from "@/lib/db/risks";
import { fetchPublicProfile, formatTriggeredByLabel } from "@/lib/profiles/profileDb";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { useProjectPermissions } from "@/contexts/ProjectPermissionsContext";
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

/**
 * `app/(protected)/template.tsx` remounts pages on client navigation while the risk-register
 * store persists. Without this, every simulation mount clears the store and refetches even for
 * the same project — visible as a wipe → “Loading…” → charts popping back in.
 */
let lastSimulationBootstrapProjectId: string | undefined;

/** Build YYYY-MM for a given date. */
function toMonthYearKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Convert YYYY-MM into an ISO month anchor date (YYYY-MM-01T00:00:00.000Z). */
function monthYearToIsoMonthDate(ym: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!match) return new Date().toISOString();
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = new Date(Date.UTC(y, Math.max(0, Math.min(11, m - 1)), 1, 0, 0, 0, 0));
  return d.toISOString();
}

/** Format YYYY-MM as "March 2025". */
function formatReportingMonthYear(ym: string | null | undefined): string {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return "—";
  const [y, m] = ym.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Options for reporting month/year: current month and next 11 months. */
function getReportingMonthYearOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const start = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    options.push({ value: toMonthYearKey(d), label: formatReportingMonthYear(toMonthYearKey(d)) });
  }
  return options;
}

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
  const simulationRef = useRef(simulation);
  simulationRef.current = simulation;

  const [activeProjectIdFromStorage, setActiveProjectIdFromStorage] = useState<string | null>(null);
  /** UUID for DB/API: URL or storage when in project routes; in legacy mode use DEFAULT_PROJECT_ID (projectContext.projectName is a display name, not a UUID). */
  const effectiveProjectId = urlProjectId ?? activeProjectIdFromStorage ?? (projectContext ? DEFAULT_PROJECT_ID : undefined);
  effectiveProjectIdRef.current = effectiveProjectId;

  const projectPerms = useProjectPermissions();
  const simulationReadOnly =
    Boolean(urlProjectId) &&
    (projectPerms == null || !projectPerms.canEditContent);

  const [reportingSnapshotRow, setReportingSnapshotRow] = useState<SimulationSnapshotRow>(null);
  const reportingDbRow = reportingSnapshotRow as SimulationSnapshotRowDb | null;
  const [setReportingModalOpen, setSetReportingModalOpen] = useState(false);
  const [reportingNote, setReportingNote] = useState("");
  const [reportingMonthYear, setReportingMonthYear] = useState(() => toMonthYearKey(new Date()));
  const [setReportingSaving, setSetReportingSaving] = useState(false);
  const [setReportingError, setSetReportingError] = useState<string | null>(null);
  const [triggeredBy, setTriggeredBy] = useState<string | null>(null);

  const reportingMonthYearOptions = useMemo(() => getReportingMonthYearOptions(), []);

  useEffect(() => {
    if (invalidRunnableCount === 0) setRunBlockedInvalidCount(null);
  }, [invalidRunnableCount]);

  useEffect(() => {
    if (simulationReadOnly && process.env.NODE_ENV === "development") {
      console.log("[project-access] simulation UI read-only", { projectId: urlProjectId });
    }
  }, [simulationReadOnly, urlProjectId]);

  useEffect(() => {
    const supabase = supabaseBrowserClient();
    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!user) {
          setTriggeredBy(null);
          return;
        }
        const profile = await fetchPublicProfile(supabase, user.id);
        setTriggeredBy(formatTriggeredByLabel(user, profile));
      })
      .catch(() => setTriggeredBy(null));
  }, []);
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
    const projectIdWeAreLoading = effectiveProjectId;
    const projectSwitched = lastSimulationBootstrapProjectId !== projectIdWeAreLoading;
    if (projectSwitched) {
      lastSimulationBootstrapProjectId = projectIdWeAreLoading;
      setLastRun(null);
      setSnapshotForProject(null);
      clearRef.current();
    } else {
      const sim = simulationRef.current;
      const cur = sim.current;
      const hasPersistedDbRun = !!(cur?.id && !cur.id.startsWith("sim_"));
      const hasNeutralRun = (sim.neutral?.iterationCount ?? 0) > 0;
      if (hasPersistedDbRun || hasNeutralRun) {
        setSnapshotForProject({ projectId: projectIdWeAreLoading, hasSnapshot: true });
        if (cur?.timestampIso) setLastRun(cur.timestampIso);
      } else {
        setSnapshotForProject({ projectId: projectIdWeAreLoading, hasSnapshot: false });
      }
    }
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

  const isCurrentRunPersisted = simulation.current?.id && !simulation.current.id.startsWith("sim_");
  const persistedRunId = simulation.current?.id;
  useEffect(() => {
    if (!effectiveProjectId || !persistedRunId || persistedRunId.startsWith("sim_")) return;
    getLatestSnapshot(effectiveProjectId)
      .then((row) => {
        if (row?.id === persistedRunId) setReportingSnapshotRow(row);
        else setReportingSnapshotRow(null);
      })
      .catch(() => setReportingSnapshotRow(null));
  }, [effectiveProjectId, persistedRunId]);

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
            if (simulationReadOnly) return;
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
          disabled={simulationReadOnly || hasDraftRisks || invalidRunnableCount > 0}
          className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          Run Simulation
        </button>
        <button
          type="button"
          onClick={() => clearSimulationHistory()}
          disabled={simulationReadOnly}
          className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          Clear History
        </button>
        {showResults &&
          isCurrentRunPersisted &&
          effectiveProjectId &&
          !reportingDbRow?.locked_for_reporting && (
          <button
            type="button"
            onClick={() => {
              if (simulationReadOnly) return;
              setSetReportingError(null);
              setSetReportingModalOpen(true);
            }}
            disabled={simulationReadOnly}
            className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            Set as reporting version
          </button>
        )}
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
      {simulationReadOnly && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2" role="status">
          View-only access: you cannot run or change simulations for this project.
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
                if (simulationReadOnly) return;
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
              disabled={simulationReadOnly || hasDraftRisks || invalidRunnableCount > 0}
              className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              Run simulation
            </button>
            {effectiveProjectId && (
              <Link
                href={`/projects/${effectiveProjectId}/run-data`}
                className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors no-underline text-[var(--foreground)]"
              >
                Go to Run Data
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

      {setReportingModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/75 dark:bg-black/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="set-reporting-version-dialog-title"
          onClick={(e) => e.target === e.currentTarget && (setSetReportingModalOpen(false), setReportingNote(""), setReportingMonthYear(toMonthYearKey(new Date())), setSetReportingError(null))}
        >
          <div
            style={{ width: "90vw", maxWidth: 400 }}
            className="shrink-0 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] shadow-xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 shrink-0 border-b border-neutral-200 dark:border-neutral-700 px-4 sm:px-6 py-3">
              <h2 id="set-reporting-version-dialog-title" className="text-lg font-semibold text-[var(--foreground)]">
                Set as reporting version
              </h2>
              <button
                type="button"
                onClick={() => { setSetReportingModalOpen(false); setReportingNote(""); setReportingMonthYear(toMonthYearKey(new Date())); setSetReportingError(null); }}
                className="p-2 rounded-md border border-transparent text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)] hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-4 sm:px-6 py-4 space-y-4">
              <div>
                <label htmlFor="reporting-month-year-select" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Reporting month / year
                </label>
                <select
                  id="reporting-month-year-select"
                  value={reportingMonthYear}
                  onChange={(e) => setReportingMonthYear(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                >
                  {reportingMonthYearOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">Locked once confirmed</p>
              </div>
              <div className="rounded-md border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-800/50 px-3 py-2.5 space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-neutral-500 dark:text-neutral-400">Reporting version</span>
                  <span className="text-neutral-500 dark:text-neutral-400 font-medium">Yes</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-neutral-500 dark:text-neutral-400">Reporting month / year</span>
                  <span className="text-neutral-500 dark:text-neutral-400">{formatReportingMonthYear(reportingMonthYear)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-neutral-500 dark:text-neutral-400">Locked by</span>
                  <span className="text-neutral-500 dark:text-neutral-400 truncate">{triggeredBy ?? "Not available"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-neutral-500 dark:text-neutral-400">Locked on</span>
                  <span className="text-neutral-500 dark:text-neutral-400">{new Date().toLocaleString()}</span>
                </div>
                <div className="flex justify-between gap-2 items-start">
                  <span className="text-neutral-500 dark:text-neutral-400 shrink-0">Reporting note</span>
                  <span className="text-neutral-500 dark:text-neutral-400 text-right min-w-0">
                    {reportingNote.trim() || "—"}
                  </span>
                </div>
              </div>
              <div>
                <label htmlFor="reporting-note-input-sim" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Reporting note
                </label>
                <textarea
                  id="reporting-note-input-sim"
                  placeholder="Why is this the reporting version?"
                  value={reportingNote}
                  onChange={(e) => setReportingNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                />
              </div>
              {setReportingError && (
                <p className="m-0 text-sm text-red-700 dark:text-red-300" role="alert">
                  {setReportingError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 shrink-0 px-4 sm:px-6 py-4 border-t border-neutral-200 dark:border-neutral-700">
              <button
                type="button"
                onClick={() => { setSetReportingModalOpen(false); setReportingNote(""); setReportingMonthYear(toMonthYearKey(new Date())); setSetReportingError(null); }}
                className="px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-[var(--foreground)] text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={setReportingSaving}
                onClick={async () => {
                  const currentId = simulation.current?.id;
                  if (!currentId || !effectiveProjectId) return;
                  setSetReportingSaving(true);
                  setSetReportingError(null);
                  try {
                    await setSnapshotAsReportingVersion(currentId, {
                      note: reportingNote,
                      lockedBy: triggeredBy ?? "Unknown",
                      reportDate: monthYearToIsoMonthDate(reportingMonthYear),
                    });
                    const row = await getLatestSnapshot(effectiveProjectId);
                    if (row?.id === currentId) setReportingSnapshotRow(row);
                    setSetReportingModalOpen(false);
                    setReportingNote("");
                    setReportingMonthYear(toMonthYearKey(new Date()));
                  } catch (error) {
                    const message =
                      error instanceof Error && error.message.trim().length > 0
                        ? error.message
                        : "Could not lock this run for reporting. Please try again.";
                    setSetReportingError(message);
                  } finally {
                    setSetReportingSaving(false);
                  }
                }}
                className="px-4 py-2 rounded-md bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-900 text-sm font-medium hover:bg-neutral-700 dark:hover:bg-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-500 disabled:opacity-60"
              >
                {setReportingSaving ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </main>
  );
}
