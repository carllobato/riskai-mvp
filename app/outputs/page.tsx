"use client";

import { useState } from "react";
import { useRiskRegister } from "@/store/risk-register.store";
import type { SimulationRiskDelta } from "@/domain/simulation/simulation.types";

function formatCost(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
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

export default function OutputsPage() {
  const [costView, setCostView] = useState<"simMean" | "expected">("simMean");
  const { simulation, runSimulation, clearSimulationHistory } = useRiskRegister();
  const { current, delta } = simulation;

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
        </>
      )}
    </main>
  );
}
