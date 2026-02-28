"use client";

import { useEffect, useMemo, useState } from "react";
import { useRiskRegister } from "@/store/risk-register.store";
import { useProjectionScenario } from "@/context/ProjectionScenarioContext";
import { calculateMomentum, detectTrajectoryState, isMitigationIneffective, portfolioMomentumSummary } from "@/domain/risk/risk.logic";
import { selectLatestSnapshotRiskIntelligence } from "@/lib/simulationSelectors";
import { getForwardSignals, normalizeForecastForDisplay } from "@/lib/forwardSignals";
import { getLatestSnapshot, getRiskHistory } from "@/lib/riskSnapshotHistory";
import { computeScenarioComparison } from "@/lib/riskForecast";
import { getBand } from "@/config/riskThresholds";
import type { SimulationRiskDelta } from "@/domain/simulation/simulation.types";
import { DecisionPanel } from "@/components/decision/DecisionPanel";
import { MitigationOptimisationPanel } from "@/components/outputs/MitigationOptimisationPanel";
import { profileToScenarioName } from "@/lib/instability/selectScenarioLens";
import { LensDebugIcon } from "@/components/debug/LensDebugIcon";
import { validateScenarioOrdering } from "@/lib/instability/validateScenarioOrdering";
import { computePortfolioExposure, computeRiskExposureCurve } from "@/engine/forwardExposure";
import type { PortfolioExposure } from "@/engine/forwardExposure";
import { normalizeScenarioId, ENGINE_SCENARIO_IDS, type EngineScenarioId } from "@/lib/scenarioId";

type DiagnosticTab = "forecast" | "simulation" | "analytics" | "forwardExposure";

/** Sub-tabs for Diagnostic Forward Exposure: Decomposition, Sensitivity, Mitigation */
type ForwardExposureSubTab = "decomposition" | "sensitivity" | "mitigation";

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

function formatCostOrDash(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatCost(value);
}

function formatPercentOrDash(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatStabilityOrDash(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}`;
}

function formatNumOrDash(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(value);
}

function formatVelocityOrDash(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return Number(value).toFixed(2);
}

function formatVolatilityOrDash(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return Number(value).toFixed(2);
}

function formatStabilityPctOrDash(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

/** Format scoreHistory timestamp as local datetime (no external libs). */
function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

/** Format number with explicit sign (+ or -), one decimal. */
function formatSigned(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "+0.0";
  return n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1);
}

function DeltaBadge({ delta }: { delta: SimulationRiskDelta }) {
  const { direction, deltaCost } = delta;
  if (direction === "up") {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
        ▲ +{formatCost(deltaCost)}
      </span>
    );
  }
  if (direction === "down") {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
        ▼ -{formatCost(Math.abs(deltaCost))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-neutral-200 text-neutral-600 dark:bg-neutral-600 dark:text-neutral-300">
      → ~0
    </span>
  );
}

function stabilityCellClass(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  if (value >= 70) return "text-green-600 dark:text-green-400";
  if (value >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export default function OutputsPage() {
  const [costView, setCostView] = useState<"simMean" | "expected">("simMean");
  const [intelligenceSort, setIntelligenceSort] = useState<"simMean" | "instability">("simMean");
  const [confidenceWeighted, setConfidenceWeighted] = useState(false);
  const [diagnosticTab, setDiagnosticTab] = useState<DiagnosticTab>("forecast");
  const [forwardExposureSubTab, setForwardExposureSubTab] = useState<ForwardExposureSubTab>("decomposition");
  const { profile: scenarioProfile, lensMode, uiMode } = useProjectionScenario();
  const { risks, simulation, runSimulation, clearSimulationHistory, riskForecastsById, forwardPressure } = useRiskRegister();
  /** Single scenario state from dropdown; drives Forward Exposure, simulation display, and P-value. */
  const selectedScenarioId: EngineScenarioId = normalizeScenarioId(scenarioProfile);
  const manualScenario = profileToScenarioName(scenarioProfile);
  const scenarioComparison = useMemo(
    () => computeScenarioComparison(
      risks.map((r) => ({ id: r.id, mitigationStrength: r.mitigationStrength })),
      getLatestSnapshot,
      getRiskHistory
    ),
    [risks]
  );
  const pressureDisplay = confidenceWeighted && forwardPressure.forwardPressureWeighted
    ? forwardPressure.forwardPressureWeighted
    : forwardPressure;
  const { current, history, delta, scenarioSnapshots } = simulation;
  /** Snapshot for selected scenario (cache: scenarioSnapshots keyed by scenarioId; no rerun when switching dropdown). */
  const snapshotForScenario = scenarioSnapshots?.[selectedScenarioId] ?? current;
  const momentumSummary = useMemo(() => portfolioMomentumSummary(risks), [risks]);
  const intelligenceRisks = useMemo(
    () => selectLatestSnapshotRiskIntelligence(snapshotForScenario ?? current, history ?? []),
    [snapshotForScenario, current, history]
  );

  const autoLensDistribution = useMemo(() => {
    if (lensMode !== "Auto" || !current?.risks?.length) return null;
    let c = 0, n = 0, a = 0;
    for (const r of current.risks) {
      const rec = riskForecastsById[r.id]?.instability?.recommendedScenario;
      if (rec === "Conservative") c++;
      else if (rec === "Aggressive") a++;
      else n++;
    }
    return { conservative: c, neutral: n, aggressive: a };
  }, [lensMode, current?.risks, riskForecastsById]);

  const lensHeaderLine =
    lensMode === "Manual"
      ? `Forecast Lens: Manual (${manualScenario})`
      : autoLensDistribution != null
        ? `Forecast Lens: Auto (risk-based) — C:${autoLensDistribution.conservative} N:${autoLensDistribution.neutral} A:${autoLensDistribution.aggressive}`
        : "Forecast Lens: Auto (risk-based)";

  /** Simulation result for selected scenario (P-value and cost distribution from same scenario). Used in Diagnostic and for scenario-specific views. */
  const baselineSummary = snapshotForScenario
    ? { p50Cost: snapshotForScenario.p50Cost, p80Cost: snapshotForScenario.p80Cost, p90Cost: snapshotForScenario.p90Cost, totalExpectedCost: snapshotForScenario.totalExpectedCost, totalExpectedDays: snapshotForScenario.totalExpectedDays }
    : null;
  const baselineEvSum = snapshotForScenario?.risks?.length
    ? snapshotForScenario.risks.reduce((s, r) => s + r.expectedCost, 0)
    : 0;

  /** Neutral baseline snapshot: always used for Meeting mode "Cost Exposure" block so project cost is scenario-invariant. */
  const snapshotNeutral = scenarioSnapshots?.neutral ?? current;
  const baselineSummaryNeutral = snapshotNeutral
    ? { p50Cost: snapshotNeutral.p50Cost, p80Cost: snapshotNeutral.p80Cost, p90Cost: snapshotNeutral.p90Cost, totalExpectedCost: snapshotNeutral.totalExpectedCost, totalExpectedDays: snapshotNeutral.totalExpectedDays }
    : null;

  const isMeeting = uiMode === "Meeting";

  /** Meeting mode: pressure label Low / Elevated / High */
  const meetingPressureLabel =
    forwardPressure.pressureClass === "Low"
      ? "Low"
      : forwardPressure.pressureClass === "Moderate"
        ? "Elevated"
        : "High";

  /** Meeting mode: early warning count */
  const earlyWarningCount = useMemo(() => {
    if (!current?.risks?.length) return 0;
    return current.risks.filter((r) => riskForecastsById[r.id]?.earlyWarning === true).length;
  }, [current?.risks, riskForecastsById]);

  /** Meeting mode: median TTC for selected scenario. */
  const meetingMedianTtc = scenarioComparison[selectedScenarioId]?.medianTtC ?? null;

  /** Diagnostic: scenario ordering validation (for Forecast Engine tab) */
  const scenarioOrderingViolation = useMemo(() => {
    if (uiMode !== "Diagnostic" || !current?.risks?.length) return false;
    const snapshots = current.risks
      .map((r) => riskForecastsById[r.id]?.scenarioTTC)
      .filter((t): t is NonNullable<typeof t> => t != null)
      .map((t) => ({
        conservativeTTC: t.conservative,
        neutralTTC: t.neutral,
        aggressiveTTC: t.aggressive,
      }));
    if (snapshots.length === 0) return false;
    const result = validateScenarioOrdering(snapshots);
    return result.flag === "ScenarioOrderingViolation";
  }, [uiMode, current?.risks, riskForecastsById]);

  /** Forward exposure: one result per engine scenario (conservative, neutral, aggressive). */
  const forwardExposure: ForwardExposurePayload = useMemo(() => {
    const horizonMonths = 12;
    const results = {} as Record<EngineScenarioId, PortfolioExposure>;
    for (const id of ENGINE_SCENARIO_IDS) {
      results[id] = computePortfolioExposure(risks, id, horizonMonths, {
        topN: 10,
        includeDebug: !isMeeting,
      });
    }
    return { horizonMonths, results };
  }, [risks, isMeeting]);

  /** Diagnostic only: sensitivity ranking by (Downside - Base) exposure delta per risk */
  const sensitivityRanking = useMemo(() => {
    const horizon = 12;
    return risks
      .map((risk) => {
        const baseCurve = computeRiskExposureCurve(risk, "neutral", horizon);
        const downCurve = computeRiskExposureCurve(risk, "aggressive", horizon);
        return {
          riskId: risk.id,
          title: risk.title,
          baseTotal: baseCurve.total,
          downTotal: downCurve.total,
          delta: downCurve.total - baseCurve.total,
        };
      })
      .sort((a, b) => b.delta - a.delta);
  }, [risks]);

  /** Diagnostic only: mitigation impact — before (no mitigation) vs after (current), and top reductions */
  const mitigationData = useMemo(() => {
    const horizon = 12;
    const noMitigationProfile = { status: "none" as const, effectiveness: 0, confidence: 0, reduces: 0, lagMonths: 0 };
    const perRisk: Array<{ riskId: string; title: string; before: number; after: number; reduced: number }> = [];
    for (const risk of risks) {
      const riskNoMitigation = { ...risk, mitigationProfile: noMitigationProfile };
      const before = computeRiskExposureCurve(riskNoMitigation, "neutral", horizon).total;
      const after = computeRiskExposureCurve(risk, "neutral", horizon).total;
      perRisk.push({ riskId: risk.id, title: risk.title, before, after, reduced: before - after });
    }
    const totalBefore = perRisk.reduce((s, r) => s + r.before, 0);
    const totalAfter = perRisk.reduce((s, r) => s + r.after, 0);
    const topMitigations = [...perRisk].sort((a, b) => b.reduced - a.reduced);
    return { totalBefore, totalAfter, topMitigations };
  }, [risks]);

  /** Diagnostic: invariant — if all three scenario totals are identical, scenario may not be applied. */
  const scenarioTotalsIdentical = useMemo(() => {
    const c = forwardExposure.results.conservative?.total ?? 0;
    const n = forwardExposure.results.neutral?.total ?? 0;
    const a = forwardExposure.results.aggressive?.total ?? 0;
    const tol = 1e-9;
    return Math.abs(c - n) <= tol && Math.abs(n - a) <= tol;
  }, [forwardExposure.results]);

  /** Portfolio result for selected scenario (Forward Exposure tiles, chart, top drivers). */
  const selectedResult = forwardExposure.results[selectedScenarioId];

  // Dev assertion: Meeting mode Cost Exposure block must always show neutral baseline; scenario toggle must not change these tiles.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !isMeeting || !snapshotNeutral) return;
    const neutralP80 = snapshotNeutral.p80Cost;
    const displayedP80 = baselineSummaryNeutral?.p80Cost;
    if (selectedScenarioId !== "neutral" && neutralP80 !== displayedP80) {
      console.error(
        "[Outputs] Meeting cost block must use neutral baseline. When selectedScenarioId !== neutral, displayed P80 should match neutral snapshot.",
        { selectedScenarioId, neutralP80, displayedP80 }
      );
    }
  }, [isMeeting, selectedScenarioId, snapshotNeutral, baselineSummaryNeutral?.p80Cost]);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold m-0">Outputs</h1>
      {!isMeeting && (
        <p className="mt-1.5 opacity-80">
          Simulation results and risk-level deltas.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => runSimulation(1000)}
          className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
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

      {isMeeting && selectedScenarioId !== "neutral" && (
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400" role="status">
          Scenario Overlay — baseline cost remains Neutral
        </p>
      )}

      {!current ? (
        <p className="mt-8 text-neutral-600 dark:text-neutral-400">
          No simulation run yet. Add risks in the Risk Register, then run a simulation.
        </p>
      ) : isMeeting ? (
        /* Meeting mode: project-first — Project Cost (baseline) first, then Scenario Exposure, then Forecast Summary. */
        <>
          {/* 1) Project Cost (Baseline – Neutral) — always first; scenario selector does not change these tiles. */}
          <section className="mt-8 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 overflow-hidden">
            <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-200 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 m-0">
              Project Cost <span className="font-normal text-neutral-500 dark:text-neutral-400">(Baseline – Neutral)</span>
            </h2>
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
      ) : (
        <>
          {/* Diagnostic: invariant warning when scenario has no effect */}
          {scenarioTotalsIdentical && (
            <div className="mt-6 rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 m-0">
                Scenario totals identical — scenario may not be applied or inputs insensitive.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 m-0">
                Conservative, neutral, and aggressive exposure totals are the same. Check risk sensitivity or engine inputs.
              </p>
            </div>
          )}
          {/* Scenario Debug Strip (Diagnostic only): proves scenario selection flows into Outputs */}
          <div className="mt-6 rounded border border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-800/80 px-3 py-2 font-mono text-xs">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <span><strong>selectedScenarioId:</strong> {selectedScenarioId}</span>
              <span><strong>conservative total:</strong> {formatCost(forwardExposure.results.conservative?.total ?? 0)}</span>
              <span><strong>neutral total:</strong> {formatCost(forwardExposure.results.neutral?.total ?? 0)}</span>
              <span><strong>aggressive total:</strong> {formatCost(forwardExposure.results.aggressive?.total ?? 0)}</span>
              <span><strong>main tile (rendered):</strong> {formatCost(selectedResult?.total ?? 0)}</span>
            </div>
          </div>

          {/* Diagnostic mode: tabbed layout */}
          <div className="mt-8">
            <div className="flex border-b border-neutral-200 dark:border-neutral-700" role="tablist" aria-label="Diagnostic tabs">
              {(["forecast", "simulation", "analytics", "forwardExposure"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={diagnosticTab === tab}
                  onClick={() => setDiagnosticTab(tab)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    diagnosticTab === tab
                      ? "border-neutral-700 dark:border-neutral-300 text-neutral-900 dark:text-neutral-100"
                      : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                  }`}
                >
                  {tab === "forecast" && "Forecast Engine"}
                  {tab === "simulation" && "Simulation Engine"}
                  {tab === "analytics" && "Risk Analytics"}
                  {tab === "forwardExposure" && "Scenario Exposure"}
                </button>
              ))}
            </div>

            {diagnosticTab === "forecast" && (
              <div className="rounded-b-lg border border-t-0 border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 p-4">
                <p className="text-sm text-neutral-600 dark:text-neutral-400 m-0">{lensHeaderLine}</p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 m-0">
                  Manual uses global Forecast Scenario; Auto uses each risk&apos;s recommended scenario (TTC, crossings, pressure, early warnings).
                </p>
                <div className="mt-4 rounded border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-3 space-y-2">
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Forward pressure</div>
                  <div className="text-sm text-neutral-700 dark:text-neutral-300">
                    Pressure class: {pressureDisplay.pressureClass} — {Math.round((pressureDisplay.pctProjectedCritical ?? 0) * 100)}% projected critical
                    {confidenceWeighted && <span className="ml-1 text-neutral-500">(confidence-weighted)</span>}
                  </div>
                  <div className="text-sm text-neutral-700 dark:text-neutral-300">
                    Momentum: {momentumSummary.portfolioPressure} · Escalating: {momentumSummary.escalatingCount} · Positive momentum: {momentumSummary.positiveMomentumCount}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <LensDebugIcon lensMode={lensMode} manualScenario={manualScenario} aggregate uiMode={uiMode} />
                    <label className="inline-flex items-center gap-1.5 cursor-pointer" title="Confidence-weighted: Downweights uncertain projections.">
                      <input
                        type="checkbox"
                        checked={confidenceWeighted}
                        onChange={(e) => setConfidenceWeighted(e.target.checked)}
                        className="rounded border-neutral-300 dark:border-neutral-600"
                      />
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">Confidence-weighted</span>
                    </label>
                  </div>
                </div>
                <div className="mt-4 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-100/50 dark:bg-neutral-800/50 px-3 py-3">
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">Forecast scenario comparison</div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {(["conservative", "neutral", "aggressive"] as const).map((profile) => {
                      const summary = scenarioComparison[profile];
                      const isActive = scenarioProfile === profile;
                      return (
                        <div
                          key={profile}
                          className={`rounded-md px-3 py-2 border ${
                            isActive ? "border-neutral-400 dark:border-neutral-500 bg-neutral-200/60 dark:bg-neutral-600/60" : "border-neutral-200 dark:border-neutral-700 bg-transparent"
                          }`}
                        >
                          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 capitalize mb-1.5">Forecast: {profile}</div>
                          <div className="text-neutral-700 dark:text-neutral-300 space-y-0.5">
                            <div>Forward pressure: {summary.forwardPressure.pressureClass}</div>
                            <div>Projected critical: {summary.projectedCriticalCount}</div>
                            <div>Median TtC: {summary.medianTtC != null ? summary.medianTtC : "—"}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {autoLensDistribution != null && (
                  <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                    Lens distribution: Conservative {autoLensDistribution.conservative} · Neutral {autoLensDistribution.neutral} · Aggressive {autoLensDistribution.aggressive}
                  </p>
                )}
                {scenarioOrderingViolation && (
                  <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <span aria-hidden>⚠</span> ScenarioOrderingViolation
                  </p>
                )}
              </div>
            )}

            {diagnosticTab === "simulation" && (
              <div className="rounded-b-lg border border-t-0 border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 m-0 mb-4">Simulation result for selected scenario ({selectedScenarioId}). P-value and cost distribution from same scenario.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">P50 Cost</div>
                    <div className="mt-1 text-lg font-semibold">{formatCost(baselineSummary?.p50Cost ?? 0)}</div>
                  </div>
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">P80 Cost</div>
                    <div className="mt-1 text-lg font-semibold">{formatCost(baselineSummary?.p80Cost ?? 0)}</div>
                  </div>
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">P90 Cost</div>
                    <div className="mt-1 text-lg font-semibold">{formatCost(baselineSummary?.p90Cost ?? 0)}</div>
                  </div>
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Mean Total Cost</div>
                    <div className="mt-1 text-lg font-semibold">{formatCost(baselineSummary?.totalExpectedCost ?? 0)}</div>
                    {(snapshotForScenario?.risks?.length ?? current?.risks?.length) ? (
                      <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">EV {formatCost(baselineEvSum)}</div>
                    ) : null}
                  </div>
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Sim StdDev</div>
                    <div className="mt-1 text-lg font-semibold">{formatCostOrDash(current.simStdDev)}</div>
                  </div>
                  {delta != null && (
                    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
                      <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Net Movement</div>
                      <div className={`mt-1 text-lg font-semibold ${delta.portfolioDeltaCost >= 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                        {delta.portfolioDeltaCost >= 0 ? "+" : ""}{formatCost(delta.portfolioDeltaCost)}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">Cost column:</span>
                  <div className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 p-0.5" role="group" aria-label="Cost view">
                    <button
                      type="button"
                      onClick={() => setCostView("simMean")}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${costView === "simMean" ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm dark:bg-neutral-700" : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"}`}
                    >
                      Sim mean
                    </button>
                    <button
                      type="button"
                      onClick={() => setCostView("expected")}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${costView === "expected" ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm dark:bg-neutral-700" : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"}`}
                    >
                      Expected (EV)
                    </button>
                  </div>
                </div>
                <div className="mt-4 w-full overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-700">
                        <th className="text-left py-3 px-3 font-medium text-neutral-600 dark:text-neutral-400">Risk</th>
                        <th className="text-right py-3 px-3 font-medium text-neutral-600 dark:text-neutral-400">{costView === "simMean" ? "Sim Mean Cost" : "Expected Cost"}</th>
                        <th className="text-left py-3 px-3 font-medium text-neutral-600 dark:text-neutral-400">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {current.risks.map((risk) => {
                        const riskDelta = delta?.riskDeltas.find((d) => d.id === risk.id);
                        const costValue = costView === "simMean" ? risk.simMeanCost : risk.expectedCost;
                        return (
                          <tr key={risk.id} className="border-b border-neutral-100 dark:border-neutral-800">
                            <td className="py-3 px-3">{risk.title}</td>
                            <td className="py-3 px-3 text-right">{formatCost(costValue)}</td>
                            <td className="py-3 px-3">{riskDelta ? <DeltaBadge delta={riskDelta} /> : <span className="text-neutral-400">—</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {diagnosticTab === "analytics" && (
              <div className="rounded-b-lg border border-t-0 border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                  <div>
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Sim Mean</div>
                    <div className="mt-0.5 text-sm font-semibold">{formatCostOrDash(baselineSummary?.totalExpectedCost)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">P50</div>
                    <div className="mt-0.5 text-sm font-semibold">{formatCostOrDash(baselineSummary?.p50Cost)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">P80</div>
                    <div className="mt-0.5 text-sm font-semibold">{formatCostOrDash(baselineSummary?.p80Cost)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">P90</div>
                    <div className="mt-0.5 text-sm font-semibold">{formatCostOrDash(baselineSummary?.p90Cost)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Sim StdDev</div>
                    <div className="mt-0.5 text-sm font-semibold">{formatCostOrDash(current.simStdDev)}</div>
                  </div>
                </div>
                <div className="mb-4 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-100/50 dark:bg-neutral-800/50 px-3 py-2">
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">Momentum (forecast / lens-aware)</div>
                  <div className="text-sm text-neutral-700 dark:text-neutral-300 space-y-0.5">
                    <div>Pressure: {momentumSummary.portfolioPressure}</div>
                    <div>Escalating: {momentumSummary.escalatingCount} ({Math.round(momentumSummary.escalatingPct * 100)}%)</div>
                    <div>Positive momentum: {momentumSummary.positiveMomentumCount} ({Math.round(momentumSummary.positiveMomentumPct * 100)}%)</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-neutral-500 dark:text-neutral-400 inline-flex items-center">
                        Projected critical (5): {typeof pressureDisplay.projectedCriticalCount === "number" && pressureDisplay.projectedCriticalCount % 1 !== 0 ? pressureDisplay.projectedCriticalCount.toFixed(1) : pressureDisplay.projectedCriticalCount} ({Math.round(pressureDisplay.pctProjectedCritical * 100)}%)
                        <LensDebugIcon lensMode={lensMode} manualScenario={manualScenario} aggregate uiMode={uiMode} />
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">Sort:</span>
                  <div className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 p-0.5" role="group" aria-label="Intelligence table sort">
                    <button type="button" onClick={() => setIntelligenceSort("simMean")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${intelligenceSort === "simMean" ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm dark:bg-neutral-700" : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"}`}>Sim Mean</button>
                    <button type="button" onClick={() => setIntelligenceSort("instability")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${intelligenceSort === "instability" ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm dark:bg-neutral-700" : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"}`}>Instability</button>
                  </div>
                </div>
                <div className="w-full overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-700">
                        <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Risk</th>
                        <th className="text-right py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">simMean</th>
                        <th className="text-right py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">simStdDev</th>
                        <th className="text-right py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">triggerRate</th>
                        <th className="text-right py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">velocity</th>
                        <th className="text-right py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">volatility</th>
                        <th className="text-right py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">stability</th>
                        <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Score history</th>
                        <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Momentum</th>
                        <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Mitigation</th>
                        <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Forecast</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...intelligenceRisks]
                        .sort((a, b) => (intelligenceSort === "simMean" ? b.simMeanCost - a.simMeanCost : a.stability - b.stability))
                        .slice(0, 10)
                        .map((risk) => {
                          const fullRisk = risks.find((r) => r.id === risk.id);
                          const scoreHistory = fullRisk?.scoreHistory ?? [];
                          const count = scoreHistory.length;
                          const lastSnapshot = count > 0 ? scoreHistory[scoreHistory.length - 1] : null;
                          const momentum = fullRisk ? calculateMomentum(fullRisk) : { shortDelta: 0, mediumDelta: 0, momentumScore: 0 };
                          const trajectory = fullRisk ? detectTrajectoryState(fullRisk) : "NEUTRAL";
                          const lastMitigationUpdate = fullRisk?.lastMitigationUpdate;
                          const postMitigationSnaps = lastMitigationUpdate != null ? scoreHistory.filter((s) => s.timestamp > lastMitigationUpdate).length : 0;
                          const ineffectiveMitigation = fullRisk ? isMitigationIneffective(fullRisk) : false;
                          const signals = getForwardSignals(risk.id, riskForecastsById);
                          const forecast = riskForecastsById[risk.id];
                          const hasForecast = signals.hasForecast && forecast != null;
                          const currentScore = lastSnapshot?.compositeScore ?? 0;
                          const currentBand = getBand(currentScore);
                          const summary = hasForecast && forecast ? { crossesCritical: forecast.baselineForecast?.crossesCriticalWithinWindow === true, timeToCriticalBaseline: forecast.baselineForecast?.timeToCritical ?? null, timeToCriticalMitigated: forecast.timeToCriticalMitigated ?? null, mitigationInsufficient: forecast.mitigationInsufficient === true, projectedPeakBand: signals.projectedPeakBand } : null;
                          const disp = summary ? normalizeForecastForDisplay(currentBand, summary) : null;
                          return (
                            <tr key={risk.id} className="border-b border-neutral-100 dark:border-neutral-800">
                              <td className="py-2 px-3">{risk.title}</td>
                              <td className="py-2 px-3 text-right">{formatCost(risk.simMeanCost)}</td>
                              <td className="py-2 px-3 text-right">{formatCost(risk.simStdDev)}</td>
                              <td className="py-2 px-3 text-right">{(risk.triggerRate * 100).toFixed(1)}%</td>
                              <td className="py-2 px-3 text-right">{formatVelocityOrDash(risk.velocity)}</td>
                              <td className="py-2 px-3 text-right">{formatVolatilityOrDash(risk.volatility)}</td>
                              <td className={`py-2 px-3 text-right ${stabilityCellClass(risk.stability)}`}>{formatStabilityPctOrDash(risk.stability)}</td>
                              <td className="py-2 px-3 text-left text-xs text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                                <div>History: {count}</div>
                                <div>Last snapshot: {lastSnapshot ? formatTimestamp(lastSnapshot.timestamp) : "—"}</div>
                                {lastSnapshot != null && <div>Last score: {Math.round(lastSnapshot.compositeScore)}</div>}
                              </td>
                              <td className="py-2 px-3 text-left text-xs text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                                <div>Δ short: {formatSigned(momentum.shortDelta)}</div>
                                <div>Δ medium: {formatSigned(momentum.mediumDelta)}</div>
                                <div>Momentum: {formatSigned(momentum.momentumScore)}</div>
                                <div>State: {trajectory}</div>
                              </td>
                              <td className="py-2 px-3 text-left text-xs text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                                <div>Mitigation updated: {lastMitigationUpdate != null ? new Date(lastMitigationUpdate).toLocaleString() : "—"}</div>
                                <div>lastMitigationUpdate (raw): {lastMitigationUpdate ?? "—"}</div>
                                <div>Post-mitigation snaps: {postMitigationSnaps}</div>
                                <div>Ineffective mitigation: {ineffectiveMitigation ? "YES" : "NO"}</div>
                              </td>
                              <td className="py-2 px-3 text-left text-xs text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                                {!hasForecast ? (<><div>Forecast: —</div><div>Insufficient history</div></>) : disp ? (
                                  <><div>Peak band: {disp.peakBandDisplay}</div><div>Crosses critical: {disp.crossesCriticalDisplay}</div><div>TtC (baseline): {disp.ttCBaselineDisplay}</div><div>TtC (mitigated): {disp.ttCMitigatedDisplay}</div><div>Mitigation insufficient: {disp.mitigationInsufficientDisplay}</div></>
                                ) : (
                                  <><div>Peak band: {signals.projectedPeakBand}</div><div>Crosses critical: —</div><div>TtC (baseline): —</div><div>TtC (mitigated): —</div><div>Mitigation insufficient: —</div></>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {diagnosticTab === "forwardExposure" && (
              <div className="rounded-b-lg border border-t-0 border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4">
                <p className="text-sm text-neutral-600 dark:text-neutral-400 m-0 mb-2">
                  Scenario Exposure — conservative (Upside), neutral (Base), aggressive (Downside). Horizon: {forwardExposure.horizonMonths} months. Selected scenario: {selectedScenarioId}.
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 m-0 mb-4 italic">
                  Scenario selection drives Forward Exposure, simulation distribution, and P-value.
                </p>
                <div className="grid grid-cols-3 gap-4 mb-2">
                  {ENGINE_SCENARIO_IDS.map((id) => {
                    const r = forwardExposure.results[id];
                    return (
                      <div key={id} className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4">
                        <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">{id}</div>
                        <div className="mt-1 text-lg font-semibold">{formatCost(r?.total ?? 0)}</div>
                        <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{forwardExposure.horizonMonths} months</div>
                      </div>
                    );
                  })}
                </div>
                <div className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
                  Concentration ({selectedScenarioId}): Top-3 share {((selectedResult?.concentration?.top3Share ?? 0) * 100).toFixed(1)}% · HHI {(selectedResult?.concentration?.hhi ?? 0).toFixed(3)}
                </div>
                {selectedResult?.debugWarnings && selectedResult.debugWarnings.length > 0 && (
                  <div className="mb-4 rounded border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 px-3 py-2">
                    <div className="text-xs font-medium text-amber-800 dark:text-amber-200 uppercase tracking-wide mb-1">Debug warnings</div>
                    <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-0.5 list-disc list-inside">
                      {selectedResult.debugWarnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex border-b border-neutral-200 dark:border-neutral-700 mb-4" role="tablist" aria-label="Forward exposure views">
                  {(["decomposition", "sensitivity", "mitigation"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={forwardExposureSubTab === tab}
                      onClick={() => setForwardExposureSubTab(tab)}
                      className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        forwardExposureSubTab === tab
                          ? "border-neutral-700 dark:border-neutral-300 text-neutral-900 dark:text-neutral-100"
                          : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                      }`}
                    >
                      {tab === "decomposition" && "Decomposition"}
                      {tab === "sensitivity" && "Sensitivity"}
                      {tab === "mitigation" && "Mitigation"}
                    </button>
                  ))}
                </div>

                {forwardExposureSubTab === "decomposition" && (
                  <div className="rounded border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] overflow-hidden">
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide px-3 py-2 border-b border-neutral-200 dark:border-neutral-700">By category ({selectedScenarioId}) — total exposure, share %, trend</div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-neutral-200 dark:border-neutral-700">
                            <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Category</th>
                            <th className="text-right py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Total exposure</th>
                            <th className="text-right py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Share %</th>
                            <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Trend</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(selectedResult?.byCategory ?? {}).length === 0 ? (
                            <tr><td colSpan={4} className="py-3 px-3 text-neutral-500 dark:text-neutral-400">No categories</td></tr>
                          ) : (
                            (() => {
                              const total = selectedResult?.total ?? 1;
                              return Object.entries(selectedResult?.byCategory ?? {}).map(([cat, val]) => (
                                <tr key={cat} className="border-b border-neutral-100 dark:border-neutral-800">
                                  <td className="py-2 px-3 capitalize">{cat}</td>
                                  <td className="py-2 px-3 text-right">{formatCost(val)}</td>
                                  <td className="py-2 px-3 text-right">{total > 0 ? ((val / total) * 100).toFixed(1) : "0"}%</td>
                                  <td className="py-2 px-3 text-neutral-500 dark:text-neutral-400">—</td>
                                </tr>
                              ));
                            })()
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {forwardExposureSubTab === "sensitivity" && (
                  <div className="rounded border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] overflow-hidden">
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide px-3 py-2 border-b border-neutral-200 dark:border-neutral-700">Ranking by (Downside − Base) exposure delta</div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-neutral-200 dark:border-neutral-700">
                            <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Risk</th>
                            <th className="text-right py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Base</th>
                            <th className="text-right py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Downside</th>
                            <th className="text-right py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Delta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sensitivityRanking.length === 0 ? (
                            <tr><td colSpan={4} className="py-3 px-3 text-neutral-500 dark:text-neutral-400">No risks</td></tr>
                          ) : (
                            sensitivityRanking.map((row) => (
                              <tr key={row.riskId} className="border-b border-neutral-100 dark:border-neutral-800">
                                <td className="py-2 px-3 text-neutral-800 dark:text-neutral-200 truncate max-w-[200px]" title={row.title}>{row.title}</td>
                                <td className="py-2 px-3 text-right">{formatCost(row.baseTotal)}</td>
                                <td className="py-2 px-3 text-right">{formatCost(row.downTotal)}</td>
                                <td className={`py-2 px-3 text-right font-medium ${row.delta >= 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                                  {row.delta >= 0 ? "+" : ""}{formatCost(row.delta)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {forwardExposureSubTab === "mitigation" && (
                  <>
                    <div className="rounded border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-3 mb-4">
                      <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">Total exposure — before vs after mitigation</div>
                      <div className="text-sm text-neutral-700 dark:text-neutral-300">
                        {formatCost(mitigationData.totalBefore)} → {formatCost(mitigationData.totalAfter)}
                        <span className="ml-2 text-neutral-500 dark:text-neutral-400">
                          (reduced by {formatCost(mitigationData.totalBefore - mitigationData.totalAfter)})
                        </span>
                      </div>
                    </div>
                    <div className="rounded border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] overflow-hidden">
                      <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide px-3 py-2 border-b border-neutral-200 dark:border-neutral-700">Top mitigations by $ reduced</div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-neutral-200 dark:border-neutral-700">
                              <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Risk</th>
                              <th className="text-right py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">Before</th>
                              <th className="text-right py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">After</th>
                              <th className="text-right py-2 px-3 font-medium text-neutral-600 dark:text-neutral-400">$ reduced</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mitigationData.topMitigations.length === 0 ? (
                              <tr><td colSpan={4} className="py-3 px-3 text-neutral-500 dark:text-neutral-400">No risks</td></tr>
                            ) : (
                              mitigationData.topMitigations.map((row) => (
                                <tr key={row.riskId} className="border-b border-neutral-100 dark:border-neutral-800">
                                  <td className="py-2 px-3 text-neutral-800 dark:text-neutral-200 truncate max-w-[200px]" title={row.title}>{row.title}</td>
                                  <td className="py-2 px-3 text-right">{formatCost(row.before)}</td>
                                  <td className="py-2 px-3 text-right">{formatCost(row.after)}</td>
                                  <td className="py-2 px-3 text-right font-medium text-green-600 dark:text-green-400">{formatCost(row.reduced)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-8">
            <DecisionPanel />
          </div>
        </>
      )}
    </main>
  );
}
