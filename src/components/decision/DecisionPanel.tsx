"use client";

import { useMemo, useState } from "react";
import { useRiskRegister } from "@/store/risk-register.store";
import { useProjectionScenario } from "@/context/ProjectionScenarioContext";
import {
  selectPortfolioDecisionSummary,
  selectTopCriticalRisks,
  selectDecisionByRiskId,
  selectRankedRisks,
  selectDecisionScoreDelta,
  SCORE_DELTA_SHOW_THRESHOLD,
} from "@/store/selectors";
import { selectLatestSnapshotRiskIntelligence } from "@/lib/simulationSelectors";
import { getScoreBand } from "@/lib/decisionScoreBand";
import { getForwardSignals } from "@/lib/forwardSignals";
import { getProfileLabel } from "@/context/ProjectionScenarioContext";
import { getBand } from "@/config/riskThresholds";
import type { RankedRiskRow } from "@/store/selectors";
import type { AlertTag } from "@/domain/decision/decision.types";

type DecisionSort = "score" | "instability" | "velocity" | "volatility";

const SORT_OPTIONS: { value: DecisionSort; label: string }[] = [
  { value: "score", label: "Score" },
  { value: "instability", label: "Instability" },
  { value: "velocity", label: "Velocity" },
  { value: "volatility", label: "Volatility" },
];

const ALERT_TAG_CLASS: Record<AlertTag, string> = {
  CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  ACCELERATING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  VOLATILE: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  UNSTABLE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  EMERGING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  IMPROVING: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

function scoreBadgeClass(score: number): string {
  const band = getScoreBand(score);
  if (band === "critical") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  if (band === "watch") return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300";
}

export function DecisionPanel() {
  const { profile: scenarioProfile } = useProjectionScenario();
  const { simulation, riskForecastsById, forwardPressure } = useRiskRegister();
  const [sortBy, setSortBy] = useState<DecisionSort>("score");

  const state = useMemo(() => ({ simulation }), [simulation]);
  const summary = useMemo(() => selectPortfolioDecisionSummary(state), [state]);
  const decisionById = useMemo(() => selectDecisionByRiskId(state), [state]);
  const scoreDeltaByRiskId = useMemo(() => selectDecisionScoreDelta(state), [state]);
  const ranked = useMemo(() => selectRankedRisks(state), [state]);
  const intelRows = useMemo(
    () => selectLatestSnapshotRiskIntelligence(simulation.current, simulation.history ?? []),
    [simulation.current, simulation.history]
  );

  const intelByRiskId = useMemo(() => {
    const map = new Map<string, { velocity: number; volatility: number; stability: number }>();
    for (const row of intelRows) {
      map.set(row.id, {
        velocity: row.velocity,
        volatility: row.volatility,
        stability: row.stability,
      });
    }
    return map;
  }, [intelRows]);

  const sortedTop10 = useMemo(() => {
    const merged: (RankedRiskRow & { velocity: number; volatility: number; stability: number })[] = ranked.map(
      (r) => {
        const intel = intelByRiskId.get(r.riskId) ?? { velocity: 0, volatility: 0, stability: 100 };
        return { ...r, ...intel };
      }
    );
    if (sortBy === "score") return merged.slice(0, 10);
    if (sortBy === "instability") return [...merged].sort((a, b) => a.stability - b.stability).slice(0, 10);
    if (sortBy === "velocity") return [...merged].sort((a, b) => b.velocity - a.velocity).slice(0, 10);
    if (sortBy === "volatility") return [...merged].sort((a, b) => b.volatility - a.volatility).slice(0, 10);
    return merged.slice(0, 10);
  }, [ranked, intelByRiskId, sortBy]);

  const displayList = sortedTop10.length > 0 ? sortedTop10 : selectTopCriticalRisks(10)(state);

  return (
    <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 overflow-hidden">
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 m-0">Decision</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400 m-0">
          Decision-grade ranking from behavioural metrics.
        </p>
        <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400 m-0" title="Adjusts drift persistence and decay for scenario testing.">
          Scenario: {getProfileLabel(scenarioProfile)}
        </p>
        <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500 m-0">
          Forecast Confidence: Based on history depth, momentum stability, and volatility.
        </p>
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-3">
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            Total Risks
          </div>
          <div className="mt-0.5 text-lg font-semibold">{summary.totalRisks}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-3">
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            Critical
          </div>
          <div className="mt-0.5 text-lg font-semibold">{summary.criticalCount}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-3">
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            Accelerating
          </div>
          <div className="mt-0.5 text-lg font-semibold">{summary.acceleratingCount}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-3">
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            Volatile
          </div>
          <div className="mt-0.5 text-lg font-semibold">{summary.volatileCount}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-3">
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            Unstable
          </div>
          <div className="mt-0.5 text-lg font-semibold">{summary.unstableCount}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-3">
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            Emerging
          </div>
          <div className="mt-0.5 text-lg font-semibold">{summary.emergingCount}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-3">
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            Avg Score
          </div>
          <div className="mt-0.5 text-lg font-semibold">{summary.avgCompositeScore.toFixed(1)}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-3">
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            Projected critical (5 cycles)
          </div>
          <div className="mt-0.5 text-lg font-semibold">{forwardPressure.projectedCriticalCount}</div>
          {forwardPressure.mitigationInsufficientCount > 0 && (
            <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              +{forwardPressure.mitigationInsufficientCount} mitigation insufficient
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm text-neutral-600 dark:text-neutral-400">Sort:</span>
        <div
          className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 p-0.5"
          role="group"
          aria-label="Decision list sort"
        >
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSortBy(opt.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                sortBy === opt.value
                  ? "bg-neutral-200 text-neutral-900 shadow-sm ring-1 ring-neutral-300 dark:bg-neutral-600 dark:text-white dark:ring-neutral-500"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4">
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
          Sorted by {sortBy === "score" ? "Score" : sortBy === "instability" ? "Instability" : sortBy === "velocity" ? "Velocity" : "Volatility"} (desc)
        </p>
        <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">Top Critical Risks</h3>
        {displayList.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">No risks. Run a simulation.</p>
        ) : (
          <ul className="list-none p-0 m-0 space-y-2">
            {displayList.map((row, index) => {
              const tags = decisionById[row.riskId]?.alertTags ?? [];
              const showTags = tags.slice(0, 2);
              const extra = tags.length > 2 ? tags.length - 2 : 0;
              const delta = scoreDeltaByRiskId[row.riskId];
              const showUp = typeof delta === "number" && delta > SCORE_DELTA_SHOW_THRESHOLD;
              const showDown = typeof delta === "number" && delta < -SCORE_DELTA_SHOW_THRESHOLD;
              const signals = getForwardSignals(row.riskId, riskForecastsById);
              const forecast = riskForecastsById[row.riskId];
              const showConfidence = index < 3 && forecast != null && typeof forecast.forecastConfidence === "number";
              const confScore = forecast?.forecastConfidence;
              const confBand = forecast?.confidenceBand ?? (typeof confScore === "number" ? (confScore < 40 ? "low" : confScore < 70 ? "medium" : "high") : null);
              const currentBand = getBand(row.compositeScore);
              const isCritical = currentBand === "critical";
              const showProjectedUp = signals.hasForecast && signals.projectedCritical && !isCritical;
              const cyclesText = signals.hasForecast && (signals.timeToCritical != null || isCritical)
                ? (isCritical ? "0 cycles" : `in ${signals.timeToCritical} cycles`)
                : null;
              const mitigationLabel = signals.hasForecast && signals.mitigationInsufficient
                ? (isCritical ? "Remains critical" : "Mitigation insufficient")
                : null;
              return (
                <li
                  key={row.riskId}
                  className="flex flex-wrap items-center gap-2 py-2 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)]"
                >
                  <span className="font-medium text-neutral-800 dark:text-neutral-200 flex-1 min-w-0 truncate">
                    {row.title || "—"}
                  </span>
                  <span
                    className={`inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-xs font-medium shrink-0 ${scoreBadgeClass(
                      row.compositeScore
                    )}`}
                  >
                    {Math.round(row.compositeScore)}
                    {showUp && <span className="opacity-90">↑</span>}
                    {showDown && <span className="opacity-90">↓</span>}
                  </span>
                  <div className="flex flex-wrap items-center gap-1 shrink-0">
                    {showProjectedUp && (
                      <span
                        className="inline-flex rounded px-1.5 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400"
                        title={cyclesText ?? undefined}
                      >
                        Projected ↑
                      </span>
                    )}
                    {cyclesText != null && (
                      <span className="text-xs text-neutral-500 dark:text-neutral-400" title={isCritical ? "Already critical" : `Reaches critical in ${signals.timeToCritical} cycles`}>
                        {cyclesText}
                      </span>
                    )}
                    {mitigationLabel != null && (
                      <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" title={isCritical ? "Remains critical within horizon" : "Mitigation still crosses critical within horizon"}>
                        <span aria-hidden>⚠</span>
                        {mitigationLabel}
                      </span>
                    )}
                    {showConfidence && confBand != null && (
                      <span
                        className="text-xs text-neutral-500 dark:text-neutral-400"
                        title="Forecast Confidence: Based on history depth, momentum stability, and volatility."
                      >
                        {typeof confScore === "number" ? `${Math.round(confScore)}%` : "—"} • {confBand.charAt(0).toUpperCase() + confBand.slice(1)}
                      </span>
                    )}
                    {showTags.map((t) => (
                      <span
                        key={t}
                        className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${ALERT_TAG_CLASS[t] ?? ""}`}
                      >
                        {t}
                      </span>
                    ))}
                    {extra > 0 && (
                      <span className="inline-flex rounded px-1.5 py-0.5 text-xs font-medium bg-neutral-200 text-neutral-600 dark:bg-neutral-600 dark:text-neutral-300">
                        +{extra}
                      </span>
                    )}
                  </div>
                  {"rank" in row && row.rank > 0 && (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">#{row.rank}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
