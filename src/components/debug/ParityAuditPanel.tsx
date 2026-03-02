"use client";

import { useMemo } from "react";
import { useRiskRegister } from "@/store/risk-register.store";
import { getNeutralSummary } from "@/store/selectors";
import type { AnalysisSelectorState } from "@/store/selectors";

/**
 * Dev-only panel: compares raw values that Outputs and Analysis would show from the same state.
 * Highlights mismatches (simple !== for raw numbers) to verify parity mode.
 */
export function ParityAuditPanel() {
  const { risks, simulation } = useRiskRegister();

  const { outputsValues, analysisValues, mismatches } = useMemo(() => {
    const snapshotNeutral = simulation.scenarioSnapshots?.neutral ?? simulation.current;
    const neutralMc = simulation.neutral;

    const outputsCost = snapshotNeutral
      ? {
          p20Cost: (snapshotNeutral as { p20Cost?: number }).p20Cost ?? snapshotNeutral.p50Cost,
          p50Cost: snapshotNeutral.p50Cost,
          p80Cost: snapshotNeutral.p80Cost,
          p90Cost: snapshotNeutral.p90Cost,
          totalExpectedCost: snapshotNeutral.totalExpectedCost,
        }
      : null;
    const outputsTime =
      neutralMc?.summary != null
        ? {
            p20Time: neutralMc.summary.p20Time,
            p50Time: neutralMc.summary.p50Time,
            p80Time: neutralMc.summary.p80Time,
            p90Time: neutralMc.summary.p90Time,
          }
        : null;

    const analysisState: AnalysisSelectorState = { risks, simulation: { ...simulation } };
    const analysisSummary = getNeutralSummary(analysisState);

    const analysisCost = analysisSummary
      ? {
          p20Cost: analysisSummary.p20Cost,
          p50Cost: analysisSummary.p50Cost,
          p80Cost: analysisSummary.p80Cost,
          p90Cost: analysisSummary.p90Cost,
          totalExpectedCost: analysisSummary.totalExpectedCost,
        }
      : null;
    const analysisTime = analysisSummary
      ? {
          p20Time: analysisSummary.p20Time,
          p50Time: analysisSummary.p50Time,
          p80Time: analysisSummary.p80Time,
          p90Time: analysisSummary.p90Time,
        }
      : null;

    const mismatches: string[] = [];
    if (outputsCost && analysisCost) {
      const costKeys = ["p20Cost", "p50Cost", "p80Cost", "p90Cost", "totalExpectedCost"] as const;
      for (const k of costKeys) {
        const a = outputsCost[k];
        const b = analysisCost[k];
        if (a !== b) mismatches.push(`Cost ${k}: Outputs=${a} Analysis=${b}`);
      }
    }
    if (outputsTime && analysisTime) {
      const timeKeys = ["p20Time", "p50Time", "p80Time", "p90Time"] as const;
      for (const k of timeKeys) {
        const a = outputsTime[k];
        const b = analysisTime[k];
        if (a !== b) mismatches.push(`Time ${k}: Outputs=${a} Analysis=${b}`);
      }
    }

    return {
      outputsValues: { cost: outputsCost, time: outputsTime },
      analysisValues: { cost: analysisCost, time: analysisTime },
      mismatches,
    };
  }, [risks, simulation]);

  if (process.env.NODE_ENV !== "development") return null;

  const hasData = outputsValues.cost != null || analysisValues.cost != null;
  if (!hasData) {
    return (
      <section className="mt-6 rounded-lg border border-dashed border-neutral-400 dark:border-neutral-500 bg-neutral-50 dark:bg-neutral-800/50 p-4">
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 m-0">
          Parity Audit (dev)
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 m-0">
          No neutral snapshot. Run simulation to compare Outputs vs Analysis values.
        </p>
      </section>
    );
  }

  const costKeys = ["p20Cost", "p50Cost", "p80Cost", "p90Cost", "totalExpectedCost"] as const;
  const timeKeys = ["p20Time", "p50Time", "p80Time", "p90Time"] as const;

  const isMismatch = (kind: "cost" | "time", key: string, out: number | undefined, an: number | undefined) => {
    if (out === undefined && an === undefined) return false;
    return out !== an;
  };

  return (
    <section className="mt-6 rounded-lg border border-dashed border-neutral-400 dark:border-neutral-500 bg-neutral-50 dark:bg-neutral-800/50 overflow-hidden">
      <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 m-0">
        Parity Audit (dev)
      </h2>
      {mismatches.length > 0 && (
        <div className="px-3 py-2 bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-200 m-0">Mismatches (raw !==)</p>
          <ul className="text-xs text-amber-700 dark:text-amber-300 mt-1 list-disc list-inside m-0">
            {mismatches.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="p-3 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-700">
              <th className="text-left py-1.5 px-2 font-medium text-neutral-600 dark:text-neutral-400">Field</th>
              <th className="text-right py-1.5 px-2 font-medium text-neutral-600 dark:text-neutral-400">Outputs (raw)</th>
              <th className="text-right py-1.5 px-2 font-medium text-neutral-600 dark:text-neutral-400">Analysis (raw)</th>
              <th className="text-left py-1.5 px-2 font-medium text-neutral-500 dark:text-neutral-500">Match</th>
            </tr>
          </thead>
          <tbody>
            {costKeys.map((key) => {
              const out = outputsValues.cost?.[key];
              const an = analysisValues.cost?.[key];
              const miss = isMismatch("cost", key, out, an);
              return (
                <tr key={key} className={miss ? "bg-amber-50 dark:bg-amber-900/20" : ""}>
                  <td className="py-1 px-2 font-mono text-neutral-700 dark:text-neutral-300">{key}</td>
                  <td className="py-1 px-2 text-right font-mono">{out ?? "—"}</td>
                  <td className="py-1 px-2 text-right font-mono">{an ?? "—"}</td>
                  <td className="py-1 px-2">{miss ? "❌" : "✓"}</td>
                </tr>
              );
            })}
            {timeKeys.map((key) => {
              const out = outputsValues.time?.[key];
              const an = analysisValues.time?.[key];
              const miss = isMismatch("time", key, out, an);
              return (
                <tr key={key} className={miss ? "bg-amber-50 dark:bg-amber-900/20" : ""}>
                  <td className="py-1 px-2 font-mono text-neutral-700 dark:text-neutral-300">{key}</td>
                  <td className="py-1 px-2 text-right font-mono">{out ?? "—"}</td>
                  <td className="py-1 px-2 text-right font-mono">{an ?? "—"}</td>
                  <td className="py-1 px-2">{miss ? "❌" : "✓"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
