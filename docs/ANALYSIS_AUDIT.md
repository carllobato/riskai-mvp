# Analysis Page — Maths & Data Lineage Audit Report

## 1. Where data comes from

- **Cost and Programme percentiles**: Produced by the Monte Carlo engine in `src/domain/simulation/monteCarlo.ts`. The Analysis page reads from `state.simulation.neutral` (cost/time samples and `summary` with p50/p80/p90 for both cost and time).
- **Neutral snapshot**: Filled when the user runs a simulation from the Risk Register. The store runs `runMonteCarloSimulation` with risks that have been passed through `applyScenarioToRiskInputs(risk, "neutral")` for scenario consistency. The same run produces `costSamples`, `timeSamples`, and `summary` (mean, p50, p80, p90, min, max for cost and time).
- **Selectors**: `getNeutralSummary`, `getNeutralSamples`, `getNeutralTimeSamples`, `getNeutralTimeSummary` in `src/store/selectors/analysis.selectors.ts` read from `state.simulation.neutral` and/or `state.simulation.scenarioSnapshots?.neutral ?? state.simulation.current`.

## 2. Pre / post / fallback

- **Rule**: Use **post-mitigation** when present (all of probability, cost ML, time ML defined and finite); otherwise **fallback to pre-mitigation**; if neither is present, use scenario-adjusted or rating-derived values on the risk.
- **Implementation**: `getEffectiveRiskInputs(risk)` in `monteCarlo.ts` implements this. It returns `null` for closed risks. For non-closed risks it chooses per field:
  - Probability: `postMitigationProbabilityPct` (0–100) or `preMitigationProbabilityPct` or `risk.probability` (0–1) or rating-derived.
  - Cost ML: `postMitigationCostML` or `preMitigationCostML` or `costImpact` / `baseCostImpact` / consequence map.
  - Time ML: `postMitigationTimeML` or `preMitigationTimeML` or `scheduleImpactDays`.
- **Presence**: Post is used only when all three post fields are “present” (defined, finite, and for numerics non-negative). Otherwise fallback is pre or legacy fields.

## 3. Closed risk filtering

- **Rule**: Ignore risks with `status === "closed"` everywhere in Analysis (Cost + Programme).
- **Implementation**: `getEffectiveRiskInputs(risk)` returns `null` when `risk.status === "closed"`. `runMonteCarloSimulation` builds the effective list with `risks.map(getEffectiveRiskInputs).filter(x => x != null)`, so closed risks are excluded from both cost and time sampling. `buildSimulationSnapshotFromResult` also skips closed risks when building per-risk snapshots. The Analysis page does not need to filter again; the engine is the single place that excludes closed.

## 4. Likely cause of “Programme excessive”

- **Bug**: The Analysis tile “Schedule Risk (P80)” was showing **mean** schedule time instead of **P80**.
- **Evidence**: `getNeutralSummary` was setting `p80Time: snap.totalExpectedDays`. On `SimulationSnapshot`, `totalExpectedDays` is the **mean** time from the run (`result.summary.meanTime` in `buildSimulationSnapshotFromResult`), not the 80th percentile of the combined time distribution.
- **Fix**: `getNeutralSummary` now sets `p80Time` from `state.simulation.neutral?.summary.p80Time` when available, and only falls back to `snap.totalExpectedDays` for backward compatibility. Programme P50/P80/P90 are taken from the Monte Carlo **combined** time distribution (percentiles of `timeSamples`), so they are not “summing percentiles” but true percentiles of the simulated programme impact.
- **Other checks**: Programme uses **time impact** (days) only, not cost. Probability is applied once per risk per iteration (trigger → add time ML). Units are **days** internally; display formats as “X days” or “X weeks” as appropriate.

## 5. What was fixed / changed

| Area | Change |
|------|--------|
| **Data lineage** | Introduced `getEffectiveRiskInputs(risk)` in `monteCarlo.ts`: post if present else pre; null for closed. |
| **Closed filtering** | Simulation and snapshot building exclude closed risks via `getEffectiveRiskInputs` (null excluded). |
| **Programme P80** | Analysis “Schedule Risk (P80)” now uses `neutral.summary.p80Time` (percentile) instead of `totalExpectedDays` (mean). |
| **Neutral summary** | `getNeutralSummary` uses `neutral.summary.p80Time` when available; `riskCount` is count of included (non-closed) risks. |
| **Audit** | “Math Audit” panel (Debug) shows: risks included, excluded (Closed), post vs pre counts, first 5 risks with chosen inputs and source, and final Cost + Programme percentiles. |
| **Tests** | `monteCarlo.test.ts` covers: closed excluded, post/pre fallback, scenario/rating fallback, and Programme P-values from combined distribution. |

## 6. Consistency with Monte Carlo engine

- Cost and Programme P-values are **derived from the same run**: one set of iterations, per iteration sum of cost and sum of time across (non-closed) risks, then percentiles taken from the combined `costSamples` and `timeSamples`. No separate or re-derived logic for Programme; the Analysis page simply reads `neutral.summary.p50Time`, `p80Time`, `p90Time` and uses them in the tile and time distribution chart when raw `timeSamples` are not needed for the chart.
