"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRiskRegister } from "@/store/risk-register.store";
import { getLatestSnapshot } from "@/lib/db/snapshots";
import {
  getNeutralSummary,
  getNeutralSamples,
  getNeutralTimeSamples,
  getNeutralTimeSummary,
} from "@/store/selectors";
import { loadProjectContext, formatMoneyMillions } from "@/lib/projectContext";
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
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4 transition-colors hover:border-neutral-300 dark:hover:border-neutral-600">
      <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-[var(--foreground)]">{value}</div>
      {helper && (
        <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{helper}</div>
      )}
    </div>
  );
}

export default function SimulationPage() {
  const { risks, simulation, runSimulation, clearSimulationHistory, hasDraftRisks } = useRiskRegister();
  const [lastRun, setLastRun] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const snapshot = await getLatestSnapshot();
      if (snapshot?.created_at) {
        setLastRun(snapshot.created_at);
      }
    }
    load();
  }, []);

  const analysisState = useMemo(
    () => ({ risks, simulation: { ...simulation } }),
    [risks, simulation]
  );

  const neutralSummary = useMemo(() => getNeutralSummary(analysisState), [analysisState]);
  const costSamples = useMemo(() => getNeutralSamples(analysisState), [analysisState]);
  const timeSamples = useMemo(() => getNeutralTimeSamples(analysisState), [analysisState]);
  const timeSummary = useMemo(() => getNeutralTimeSummary(analysisState), [analysisState]);

  const projectContext = useMemo(() => loadProjectContext(), []);
  const iterationCount = simulation.neutral?.iterationCount ?? 0;
  const snapshotRisks = simulation.current?.risks ?? EMPTY_SNAPSHOT_RISKS;

  const hasData = neutralSummary != null;

  const baseline: SimulationSectionBaseline | null = useMemo(() => {
    const targetPNumeric = projectContext
      ? riskAppetiteToPercent(projectContext.riskAppetite)
      : 80;
    const targetPLabel = projectContext?.riskAppetite ?? "P80";
    return {
      targetPNumeric,
      targetPLabel,
      approvedValue: 0,
    };
  }, [projectContext]);

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
    if (!projectContext) return null;
    return projectContext.approvedBudget_m * 1e6;
  }, [projectContext]);

  const plannedDurationDays = useMemo(() => {
    if (!projectContext) return null;
    return (projectContext.plannedDuration_months * 365) / 12;
  }, [projectContext]);

  const contingencyDays = useMemo(() => {
    if (!projectContext?.scheduleContingency_weeks) return null;
    return projectContext.scheduleContingency_weeks * 7;
  }, [projectContext]);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold m-0 text-[var(--foreground)]">Simulation</h1>
        <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={async () => {
            try {
              await runSimulation(10000);
              setLastRun(new Date().toISOString());
            } catch {
              // Snapshot insert failed; do not update timestamp
            }
          }}
          disabled={hasDraftRisks}
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
      {lastRun && (
        <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
          Last simulation run: {new Date(lastRun).toLocaleString()}
        </div>
      )}
      {hasDraftRisks && (
        <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 text-right" role="status">
          Review and save all draft risks in the Risk Register before running simulation.
        </p>
      )}

      {!hasData && (
        <div className="mt-8 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-6 text-center">
          <p className="text-[var(--foreground)] font-medium m-0">
            Run a simulation to see results.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={async () => {
                try {
                  await runSimulation(10000);
                  setLastRun(new Date().toISOString());
                } catch {
                  // Snapshot insert failed; do not update timestamp
                }
              }}
              disabled={hasDraftRisks}
              className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              Run simulation
            </button>
            <Link
              href="/outputs"
              className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors no-underline text-[var(--foreground)]"
            >
              Go to Outputs
            </Link>
          </div>
        </div>
      )}

      {hasData && (
        <>
          {/* Group 1 — Baseline */}
          <section className="mt-8 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 overflow-hidden">
            <h2 className="text-base font-semibold text-[var(--foreground)] px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 m-0">
              Baseline
            </h2>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricTile
                  label="Base value"
                  value={formatDash(projectContext?.projectValue_m, (m) => formatMoneyMillions(m))}
                  helper="Base value"
                />
                <MetricTile
                  label="Contingency Value ($)"
                  value={formatDash(projectContext?.contingencyValue_m, (m) => formatMoneyMillions(m))}
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
                  value={projectContext?.riskAppetite ?? "—"}
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
                formatCostValue={projectContext ? (dollars) => formatMoneyMillions(dollars / 1e6) : undefined}
                contingencyValueDollars={projectContext ? projectContext.contingencyValue_m * 1e6 : undefined}
              />
            )}
            {timeBaseline && (
              <SimulationSection
                title="Schedule Simulation"
                mode="time"
                baseline={timeBaseline}
                results={timeResults}
                timeCdf={timeCdf}
              />
            )}
          </section>
        </>
      )}
    </main>
  );
}
