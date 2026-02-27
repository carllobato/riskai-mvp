"use client";

import { useMemo, useState } from "react";
import { useRiskRegister } from "@/store/risk-register.store";
import { selectLatestSnapshotRiskIntelligence } from "@/lib/simulationSelectors";
import type { SimulationRiskDelta } from "@/domain/simulation/simulation.types";
import { DecisionPanel } from "@/components/decision/DecisionPanel";

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
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);
  const [intelligenceSort, setIntelligenceSort] = useState<"simMean" | "instability">("simMean");
  const { simulation, runSimulation, clearSimulationHistory } = useRiskRegister();
  const { current, history, delta } = simulation;
  const intelligenceRisks = useMemo(
    () => selectLatestSnapshotRiskIntelligence(current, history ?? []),
    [current, history]
  );

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold m-0">Outputs</h1>
      <p className="mt-1.5 opacity-80">
        Simulation results and risk-level deltas.
      </p>

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

      {!current ? (
        <p className="mt-8 text-neutral-600 dark:text-neutral-400">
          No simulation run yet. Add risks in the Risk Register, then run a simulation.
        </p>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4">
              <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">P50 Cost</div>
              <div className="mt-1 text-lg font-semibold">{formatCost(current.p50Cost)}</div>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4">
              <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">P80 Cost</div>
              <div className="mt-1 text-lg font-semibold">{formatCost(current.p80Cost)}</div>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4">
              <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">P90 Cost</div>
              <div className="mt-1 text-lg font-semibold">{formatCost(current.p90Cost)}</div>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4">
              <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Mean Total Cost</div>
              <div className="mt-1 text-lg font-semibold">{formatCost(current.totalExpectedCost)}</div>
              {current.risks.length > 0 && (
                <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  EV {formatCost(current.risks.reduce((s, r) => s + r.expectedCost, 0))}
                </div>
              )}
            </div>
            {delta != null && (
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4">
                <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Net Movement</div>
                <div className={`mt-1 text-lg font-semibold ${delta.portfolioDeltaCost >= 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                  {delta.portfolioDeltaCost >= 0 ? "+" : ""}{formatCost(delta.portfolioDeltaCost)}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Cost column:</span>
            <div
              className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 p-0.5"
              role="group"
              aria-label="Cost view"
            >
              <button
                type="button"
                onClick={() => setCostView("simMean")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  costView === "simMean"
                    ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm dark:bg-neutral-700"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                }`}
              >
                Sim mean
              </button>
              <button
                type="button"
                onClick={() => setCostView("expected")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  costView === "expected"
                    ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm dark:bg-neutral-700"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                }`}
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
                  <th className="text-right py-3 px-3 font-medium text-neutral-600 dark:text-neutral-400">
                    {costView === "simMean" ? "Sim Mean Cost" : "Expected Cost"}
                  </th>
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
                      <td className="py-3 px-3">
                        {riskDelta ? <DeltaBadge delta={riskDelta} /> : <span className="text-neutral-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <section className="mt-8 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setIntelligenceOpen((o) => !o)}
              className="w-full flex items-center justify-between py-3 px-4 text-left text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors"
              aria-expanded={intelligenceOpen}
            >
              <span>Intelligence (Debug)</span>
              <span className="text-neutral-500 dark:text-neutral-400" aria-hidden>
                {intelligenceOpen ? "▼" : "▶"}
              </span>
            </button>
            {intelligenceOpen && (
              <div className="border-t border-neutral-200 dark:border-neutral-700 p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                  <div>
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Sim Mean</div>
                    <div className="mt-0.5 text-sm font-semibold">{formatCostOrDash(current.totalExpectedCost)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">P50</div>
                    <div className="mt-0.5 text-sm font-semibold">{formatCostOrDash(current.p50Cost)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">P80</div>
                    <div className="mt-0.5 text-sm font-semibold">{formatCostOrDash(current.p80Cost)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">P90</div>
                    <div className="mt-0.5 text-sm font-semibold">{formatCostOrDash(current.p90Cost)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Sim StdDev</div>
                    <div className="mt-0.5 text-sm font-semibold">{formatCostOrDash(current.simStdDev)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">Sort:</span>
                  <div
                    className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 p-0.5"
                    role="group"
                    aria-label="Intelligence table sort"
                  >
                    <button
                      type="button"
                      onClick={() => setIntelligenceSort("simMean")}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        intelligenceSort === "simMean"
                          ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm dark:bg-neutral-700"
                          : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                      }`}
                    >
                      Sim Mean
                    </button>
                    <button
                      type="button"
                      onClick={() => setIntelligenceSort("instability")}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        intelligenceSort === "instability"
                          ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm dark:bg-neutral-700"
                          : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                      }`}
                    >
                      Instability
                    </button>
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
                      </tr>
                    </thead>
                    <tbody>
                      {[...intelligenceRisks]
                        .sort((a, b) =>
                          intelligenceSort === "simMean"
                            ? b.simMeanCost - a.simMeanCost
                            : a.stability - b.stability
                        )
                        .slice(0, 10)
                        .map((risk) => (
                          <tr key={risk.id} className="border-b border-neutral-100 dark:border-neutral-800">
                            <td className="py-2 px-3">{risk.title}</td>
                            <td className="py-2 px-3 text-right">{formatCost(risk.simMeanCost)}</td>
                            <td className="py-2 px-3 text-right">{formatCost(risk.simStdDev)}</td>
                            <td className="py-2 px-3 text-right">{(risk.triggerRate * 100).toFixed(1)}%</td>
                            <td className="py-2 px-3 text-right">{formatVelocityOrDash(risk.velocity)}</td>
                            <td className="py-2 px-3 text-right">{formatVolatilityOrDash(risk.volatility)}</td>
                            <td className={`py-2 px-3 text-right ${stabilityCellClass(risk.stability)}`}>
                              {formatStabilityPctOrDash(risk.stability)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <div className="mt-8">
            <DecisionPanel />
          </div>
        </>
      )}
    </main>
  );
}
