"use client";

import { useMemo, useEffect, useState } from "react";
import { useRiskRegister } from "@/store/risk-register.store";
import { listRisks } from "@/lib/db/risks";
import { useProjectionScenario } from "@/context/ProjectionScenarioContext";
import { portfolioMomentumSummary } from "@/domain/risk/risk.logic";
import { getLatestSnapshot, getRiskHistory } from "@/lib/riskSnapshotHistory";
import { computeScenarioComparison } from "@/lib/riskForecast";
import { MitigationOptimisationPanel } from "@/components/outputs/MitigationOptimisationPanel";
import { computePortfolioExposure } from "@/engine/forwardExposure";
import type { PortfolioExposure } from "@/engine/forwardExposure";
import { normalizeScenarioId, ENGINE_SCENARIO_IDS, type EngineScenarioId } from "@/lib/scenarioId";
import { formatDurationDays } from "@/lib/formatDuration";

/** Forward exposure payload keyed by engine scenario IDs (conservative, neutral, aggressive). */
type ForwardExposurePayload = {
  horizonMonths: number;
  results: Record<EngineScenarioId, PortfolioExposure>;
};

function formatCost(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export type RunDataPageProps = { projectId?: string | null };

/**
 * Run Data — internal source-of-truth page for simulation run results.
 * Stores and manages run metadata, percentile outputs, exposure, contingency, coverage ratio,
 * ranked cost/schedule risks, histogram source data, and report lock / official run status.
 */
export default function RunDataPage({ projectId }: RunDataPageProps = {}) {
  const { profile: scenarioProfile } = useProjectionScenario();
  const { risks, simulation, runSimulation, clearSimulationHistory, hasDraftRisks, invalidRunnableCount, riskForecastsById, forwardPressure, setRisks } = useRiskRegister();
  const [runBlockedInvalidCount, setRunBlockedInvalidCount] = useState<number | null>(null);

  useEffect(() => {
    if (!projectId) return;
    listRisks(projectId)
      .then((loaded) => setRisks(loaded))
      .catch((err) => console.error("[run-data] load risks", err));
    // Intentionally depend only on projectId; setRisks identity changes when store state updates and would cause a re-fetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  useEffect(() => {
    if (invalidRunnableCount === 0) setRunBlockedInvalidCount(null);
  }, [invalidRunnableCount]);

  const selectedScenarioId: EngineScenarioId = normalizeScenarioId(scenarioProfile);
  const scenarioComparison = useMemo(
    () => computeScenarioComparison(
      risks.map((r) => ({ id: r.id, mitigationStrength: r.mitigationStrength })),
      getLatestSnapshot,
      getRiskHistory
    ),
    [risks]
  );
  const meetingMedianTtc = scenarioComparison[selectedScenarioId]?.medianTtC ?? null;
  const { current, scenarioSnapshots, neutral: neutralMc } = simulation;
  const momentumSummary = useMemo(() => portfolioMomentumSummary(risks), [risks]);

  /** Neutral baseline snapshot: always used for Project Cost block so project cost is scenario-invariant. */
  const snapshotNeutral = scenarioSnapshots?.neutral ?? current;
  const baselineSummaryNeutral = snapshotNeutral
    ? {
        p20Cost: (snapshotNeutral as { p20Cost?: number }).p20Cost ?? snapshotNeutral.p50Cost ?? 0,
        p50Cost: snapshotNeutral.p50Cost,
        p80Cost: snapshotNeutral.p80Cost,
        p90Cost: snapshotNeutral.p90Cost,
        totalExpectedCost: snapshotNeutral.totalExpectedCost,
        totalExpectedDays: snapshotNeutral.totalExpectedDays,
      }
    : null;

  /** Pressure label Low / Elevated / High */
  const meetingPressureLabel =
    forwardPressure.pressureClass === "Low"
      ? "Low"
      : forwardPressure.pressureClass === "Moderate"
        ? "Elevated"
        : "High";

  /** Early warning count */
  const earlyWarningCount = useMemo(() => {
    if (!current?.risks?.length) return 0;
    return current.risks.filter((r) => riskForecastsById[r.id]?.earlyWarning === true).length;
  }, [current, riskForecastsById]);

  /** Forward exposure: one result per engine scenario (conservative, neutral, aggressive). */
  const forwardExposure: ForwardExposurePayload = useMemo(() => {
    const horizonMonths = 12;
    const results = {} as Record<EngineScenarioId, PortfolioExposure>;
    for (const id of ENGINE_SCENARIO_IDS) {
      results[id] = computePortfolioExposure(risks, id, horizonMonths, {
        topN: 10,
        includeDebug: false,
      });
    }
    return { horizonMonths, results };
  }, [risks]);

  /** Portfolio result for selected scenario (Forward Exposure tiles, chart, top drivers). */
  const selectedResult = forwardExposure.results[selectedScenarioId];

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold m-0">Run Data</h1>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={async () => {
            const result = await runSimulation(10000, projectId ?? undefined);
            if (!result.ran && result.blockReason === "invalid") {
              setRunBlockedInvalidCount(result.invalidCount);
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
        {hasDraftRisks && (
          <p className="text-sm text-amber-600 dark:text-amber-400" role="status">
            Review and save all draft risks in the Risk Register before running simulation.
          </p>
        )}
        {invalidRunnableCount > 0 && (
          <p className="text-sm text-amber-600 dark:text-amber-400" role="status">
            Fix {invalidRunnableCount} risk{invalidRunnableCount !== 1 ? "s" : ""} to run simulation.
          </p>
        )}
        {runBlockedInvalidCount != null && runBlockedInvalidCount > 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium" role="alert">
            Simulation blocked: fix {runBlockedInvalidCount} risk{runBlockedInvalidCount !== 1 ? "s" : ""} to run simulation.
          </p>
        )}
      </div>

      {selectedScenarioId !== "neutral" && (
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400" role="status">
          Scenario Overlay — baseline cost remains Neutral
        </p>
      )}

      {!current ? (
        <p className="mt-8 text-neutral-600 dark:text-neutral-400">
          No simulation run yet. Add risks in the Risk Register, then run a simulation.
        </p>
      ) : (
        <>
          {/* 1) Project Cost (Baseline – Neutral) */}
          <section className="mt-8 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 overflow-hidden">
            <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-200 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 m-0">
              Project Cost <span className="font-normal text-neutral-500 dark:text-neutral-400">(Baseline – Neutral)</span>
            </h2>
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">P20</div>
                  <div className="mt-1 text-lg font-semibold">{formatCost(baselineSummaryNeutral?.p20Cost ?? 0)}</div>
                </div>
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">P50</div>
                  <div className="mt-1 text-lg font-semibold">{formatCost(baselineSummaryNeutral?.p50Cost ?? 0)}</div>
                </div>
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">P80</div>
                  <div className="mt-1 text-lg font-semibold">{formatCost(baselineSummaryNeutral?.p80Cost ?? 0)}</div>
                </div>
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">P90</div>
                  <div className="mt-1 text-lg font-semibold">{formatCost(baselineSummaryNeutral?.p90Cost ?? 0)}</div>
                </div>
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Mean</div>
                  <div className="mt-1 text-lg font-semibold">{formatCost(baselineSummaryNeutral?.totalExpectedCost ?? 0)}</div>
                </div>
              </div>
              {neutralMc?.summary != null && (
                <>
                  <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">Programme (Baseline – Neutral)</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: "P20", value: neutralMc.summary.p20Time },
                        { label: "P50", value: neutralMc.summary.p50Time },
                        { label: "P80", value: neutralMc.summary.p80Time },
                        { label: "P90", value: neutralMc.summary.p90Time },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
                          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">{label}</div>
                          <div className="mt-1 text-lg font-semibold">{formatDurationDays(value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* 2) Scenario Exposure — forward exposure for selected scenario; concentration in secondary row. */}
          <section className="mt-6 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 overflow-hidden">
            <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-200 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 m-0">
              Scenario Exposure
            </h2>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                    {selectedScenarioId === "conservative" ? "Upside" : selectedScenarioId === "aggressive" ? "Downside" : "Base"} exposure
                  </div>
                  <div className="mt-1 text-lg font-semibold">{formatCost(selectedResult?.total ?? 0)}</div>
                </div>
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Downside exposure</div>
                  <div className="mt-1 text-lg font-semibold">{formatCost(forwardExposure.results.aggressive?.total ?? 0)}</div>
                </div>
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                Concentration: Top-3 share {((selectedResult?.concentration?.top3Share ?? 0) * 100).toFixed(1)}% · HHI {(selectedResult?.concentration?.hhi ?? 0).toFixed(3)}
              </div>
              <div className="rounded border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-3 mb-4">
                <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
                  Monthly exposure — selected vs Downside
                </div>
                <div className="w-full" style={{ height: 140 }}>
                  {(() => {
                    const selectedMonthly = (selectedResult?.monthlyTotal ?? []).slice(0, 12);
                    const down = (forwardExposure.results.aggressive?.monthlyTotal ?? []).slice(0, 12);
                    const maxVal = Math.max(1, ...selectedMonthly, ...down);
                    const w = 100;
                    const h = 100;
                    const toPoints = (arr: number[]) =>
                      arr.map((v, i) => `${(i / 11) * w},${h - (v / maxVal) * h}`);
                    const areaPath = (arr: number[]) => {
                      const pts = toPoints(arr);
                      if (pts.length === 0) return `M 0,${h} L ${w},${h} Z`;
                      return `M 0,${h} L ${pts.join(" L ")} L ${w},${h} Z`;
                    };
                    return (
                      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full min-h-[100px]">
                        <defs>
                          <linearGradient id="areaBase" x1="0" y1="1" x2="0" y2="0">
                            <stop offset="0%" stopColor="rgb(59 130 246 / 0.3)" />
                            <stop offset="100%" stopColor="rgb(59 130 246 / 0)" />
                          </linearGradient>
                          <linearGradient id="areaDown" x1="0" y1="1" x2="0" y2="0">
                            <stop offset="0%" stopColor="rgb(234 88 12 / 0.25)" />
                            <stop offset="100%" stopColor="rgb(234 88 12 / 0)" />
                          </linearGradient>
                        </defs>
                        <path fill="url(#areaDown)" d={areaPath(down)} />
                        <path fill="url(#areaBase)" d={areaPath(selectedMonthly)} />
                        <polyline fill="none" stroke="rgb(234 88 12)" strokeWidth="0.8" points={toPoints(down).join(" ")} />
                        <polyline fill="none" stroke="rgb(59 130 246)" strokeWidth="0.8" points={toPoints(selectedMonthly).join(" ")} />
                      </svg>
                    );
                  })()}
                </div>
                <div className="mt-1.5 flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-blue-500 rounded" /> {selectedScenarioId === "conservative" ? "Upside" : selectedScenarioId === "aggressive" ? "Downside" : "Base"}</span>
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-orange-500 rounded" /> Downside</span>
                </div>
              </div>
              <div className="rounded border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-3">
                <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">Top 5 drivers</div>
                <ul className="space-y-2 text-sm">
                  {(selectedResult?.topDrivers ?? []).slice(0, 5).map((d) => {
                    const title = risks.find((r) => r.id === d.riskId)?.title ?? d.riskId;
                    return (
                      <li key={d.riskId} className="flex justify-between items-baseline gap-2">
                        <span className="text-neutral-800 dark:text-neutral-200 truncate">{title}</span>
                        <span className="font-medium text-neutral-700 dark:text-neutral-300 shrink-0">{formatCost(d.total)}</span>
                      </li>
                    );
                  })}
                  {(selectedResult?.topDrivers ?? []).length === 0 && (
                    <li className="text-neutral-500 dark:text-neutral-400">No drivers</li>
                  )}
                </ul>
              </div>
            </div>
          </section>

          {/* 3) Forecast Summary — pressure, projected critical, early warning, median TTC. */}
          <section className="mt-6 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 overflow-hidden">
            <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-200 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 m-0">
              Forecast Summary
            </h2>
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                <div>
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Forward pressure</div>
                  <div className="mt-0.5 font-medium text-neutral-800 dark:text-neutral-200">{meetingPressureLabel}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Projected critical</div>
                  <div className="mt-0.5 font-medium text-neutral-800 dark:text-neutral-200">{forwardPressure.projectedCriticalCount}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Escalating</div>
                  <div className="mt-0.5 font-medium text-neutral-800 dark:text-neutral-200">{momentumSummary.escalatingCount}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Early warning</div>
                  <div className="mt-0.5 font-medium text-neutral-800 dark:text-neutral-200">{earlyWarningCount}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Median TTC</div>
                  <div className="mt-0.5 font-medium text-neutral-800 dark:text-neutral-200">{meetingMedianTtc != null ? meetingMedianTtc : "—"}</div>
                </div>
              </div>
            </div>
          </section>

          {/* 4) Mitigation leverage — API only; requires simulation snapshot. */}
          {snapshotNeutral ? (
            <MitigationOptimisationPanel />
          ) : (
            <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
              Run simulation to see mitigation leverage.
            </p>
          )}

        </>
      )}
    </main>
  );
}
