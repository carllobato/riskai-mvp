# Run-Data: Mitigation Leverage & Forecasting — Calculation Validation

## 1. Mitigation Leverage API validation

### Request inputs
- **POST body (optional):** `spendSteps` (default `[0, 25_000, 50_000, 100_000, 200_000]`), `budgetCap`, `benefitMetric` (default `"p80CostReduction"`).
- **Data:** Risks and neutral snapshot loaded server-side via `getSimulationContext()`. Context is populated by the client when the store syncs after a simulation run (`POST /api/simulation-context`). `neutralSnapshot = current` (same as run-data Cost Distribution source).

### Engine
- **Module:** `@/engine/mitigationOptimisation`
- **Entry:** `computeMitigationOptimisation({ risks, neutralSnapshot, spendSteps, benefitMetric, budgetCap })`
- **Baseline:** `getNeutralP80Cost(neutralSnapshot)` → `neutralSnapshot.p80Cost` (Monte Carlo P80 cost from neutral run).

### Metrics returned by API (and shown in panel)

| Metric | Source | Formula | Validation result |
|--------|--------|---------|-------------------|
| **Baseline (Neutral) P80** | `neutralSnapshot.p80Cost` from simulation context | Same as Cost Distribution P80: Monte Carlo neutral run 80th percentile cost | **VALID** — Label matches (neutral run P80 cost). |
| **Ranked list order** | `computeMitigationOptimisation` result `ranked` | Sorted by `leverageScore` desc = `topBandBenefitPerDollar * materialityWeight`; tie-break by weight then name | **VALID** — Order is by leverage score. |
| **Best ROI band** | Per-risk curve over `spendSteps` | Band (from–to $) with highest `benefitPerDollar` for that risk | **VALID** — Matches engine. |
| **Benefit per $** (column) | Per-risk `topBandBenefitPerDollar` | First band with `incrementalSpend > 0` → that band’s `marginalBenefit / incrementalSpend` | **VALID WITH CAVEAT** — Column shows first-spend-band benefit per $; ranking uses leverage = that value × weight. "Best ROI band" can be a different band (max benefitPerDollar); so "Benefit per $" is not necessarily the best band’s value. |
| **Explanation** | Engine string | Materiality weight, best ROI band, benefit per $, default flags | **VALID** — Informational. |

### Benefit calculation (engine)
- **Not** “P80 before − P80 after” from a second Monte Carlo run.
- **Model:** `benefitAt(spend) = neutralP80 × materialityWeight × reduction(spend, maxReduction, k)` where `reduction(spend) = maxReduction × (1 − exp(−k × spend))`.
- So benefit is **projected** P80 cost reduction (in $) from a parametric curve, not measured post-mitigation P80.

### ROI / “Benefit per $”
- **Formula:** `benefitPerDollar = marginalBenefit / incrementalSpend` for each spend band (and for first non-zero band → `topBandBenefitPerDollar`).
- Panel label “Benefit per $” matches this.

### Scope
- **Cost only.** Uses `neutralP80` (cost) and cost-based materiality. No schedule. Panel does not imply total project exposure; “P80” is cost P80.

### Consistency with Mitigation Results section
- **Mitigation Results:** Pre/post = sum of **forward exposure** cost drivers (deterministic curves). Post = sum(costDrivers.postMitigation) = sum of neutral scenario exposure for cost-impact risks.
- **Mitigation Leverage baseline:** **Monte Carlo P80** cost from the same run.
- These are different metrics (percentile vs expected exposure). They need not and generally will not match. No reconciliation required; both are valid for their purpose.

### Rounding
- **Baseline P80:** `formatCost` (0 decimals) in panel — matches run-data.
- **Benefit per $:** `.toFixed(2)` — 2 decimals; acceptable for ratio. No HHI/percent here.

---

## 2. Forecasting validation

### Exposure engine (forward exposure)

| Metric | Source | Formula | Validation result |
|--------|--------|---------|-------------------|
| **Monthly exposure table** | `selectedResult.monthlyTotal` | `computePortfolioExposure(risks, "neutral", horizonMonths)` → `portfolio.monthlyTotal`; each cell = sum of risk curves’ `monthlyExposure[m]` for that month | **VALID** — Real engine output. |
| **Peak exposure period** | Page-derived from `selectedResult.monthlyTotal` | `peakIdx = argmax(monthlyTotal)`; display “Month {peakIdx + 1}” (1-based) | **VALID** — Matches spec. |
| **Peak value** | Same array | `peakVal = monthlyTotal[peakIdx]`; displayed with `formatCost(peakVal)` | **VALID** — Matches table. |

**Units:** Forward exposure curves are **cost only** (`baseCostImpact` × probability × time weight × mitigation). So “Exposure over time” = **cost exposure** by month. Label should state “cost” to align with Baseline Exposure and Mitigation Results.

### Risk trajectory engine (pressure / TTC / early warning)

| Metric | Source | Formula | Validation result |
|--------|--------|---------|-------------------|
| **Forward pressure** | `forwardPressure` from store | `computePortfolioForwardPressure(Object.values(riskForecastsById))`; `riskForecastsById` from `runForwardProjection(risks, getLatestSnapshot, getRiskHistory, { profile })` | **VALID** — Risk forecast layer. |
| **Pressure label (Low / Elevated / High)** | Same | `pressureClass`: Low &lt; 10% projected critical, Moderate ≤ 20%, High ≤ 35%, else Severe; page maps Moderate → “Elevated” | **VALID** — Label matches. |
| **Projected critical** | Same | `forwardPressure.projectedCriticalCount` = count of risks with `baselineForecast.projectedCritical === true` (current band ≠ critical but projection crosses critical in horizon) | **VALID** — Count. |
| **Escalating** | `momentumSummary` | `portfolioMomentumSummary(risks).escalatingCount`; from `risk.logic`: count where `detectTrajectoryState(risk) === "ESCALATING"` | **VALID** — Momentum layer. |
| **Early warning** | `riskForecastsById` | Count of risks where `riskForecastsById[r.id].earlyWarning === true`; `earlyWarning` from `computeEarlyWarning({ eiiIndex, timeToCritical, confidence })` (EII ≥ 60 with non-imminent TTC, or EII ≥ 50 and confidence &lt; 0.45) | **VALID** — Instability/EII layer. |
| **Median TTC** | Risk forecasts (`riskForecastsById`) | Median of `riskForecastsById[*].baselineForecast.timeToCritical` on neutral model | **VALID** — Neutral baseline trajectory layer. |

### Boundary
- **Exposure engine:** monthly totals, peak period, peak value (all **cost** exposure from `computePortfolioExposure`).
- **Risk trajectory engine:** pressure, projected critical, escalating, early warning, median TTC (from risk forecast / momentum).
- The page groups them as “Exposure over time” + peak vs “Pressure and trajectory”. Adding a short subheading or sentence that exposure is from the forward exposure engine and pressure/trajectory from the risk forecast engine would make the boundary explicit.

### Rounding
- Exposure table and peak value: `formatCost` (0 decimals). Percentages elsewhere on page: 1 decimal. HHI: 3 decimals. No change needed for forecasting.

---

## 3. Issues found

| Issue | Severity | Location |
|-------|----------|----------|
| **Benefit is model-based, not measured** | Low | Mitigation Leverage — Panel does not state that “benefit” is projected from a parametric curve, not P80_after from a rerun. |
| **“Benefit per $” vs “Best ROI band”** | Low | Panel table: “Benefit per $” is first non-zero band’s value; “Best ROI band” is the band with max benefit per $. They can differ. |
| **Ranking by leverage, not by displayed column** | Low | Table is ordered by `leverageScore` (benefit per $ × weight), not by “Benefit per $” alone. Copy says “ranked … by benefit per dollar”; more accurate: “by leverage (benefit per $ × materiality weight)”. |
| **Exposure over time units** | Low | Forecasting “Exposure over time” is cost only; label does not say “cost”. |

No incorrect arithmetic or wrong data sources; only clarity and labelling.

---

## 4. Recommended fixes

### Label / copy (no logic change)
1. **Mitigation Leverage panel**
   - Add one line: e.g. “Baseline = Monte Carlo neutral P80 cost (same run as Cost Distribution). Benefit is projected from a parametric model, not from a second simulation.”
   - Optionally: “Ranking by leverage score (benefit per $ × materiality weight).”
   - Optionally: Clarify that “Benefit per $” is for the first spend band; “Best ROI band” may be a different band.

2. **Forecasting**
   - Under “Exposure over time”, add “(cost exposure)” or “Cost exposure by month” so units match Baseline Exposure.

3. **Forecasting boundary**
   - Add a one-line note before “Pressure and trajectory”: e.g. “The metrics below are from the risk forecast / trajectory engine (composite score projection, EII, TTC), not from the exposure engine.”

### Rounding
- No change: panel uses `formatCost` and `.toFixed(2)` for benefit per $; consistent with rest of run-data.

### Code corrections
- None required for correctness. Optional: in the engine, expose `curve[bestROIIndex].benefitPerDollar` so the panel could show “benefit per $ of best band” if product prefers that column to match “Best ROI band”.

---

## 5. Final confidence rating

- **Mitigation Leverage:** **High** — Baseline is Monte Carlo P80; benefit and ROI formulas are well-defined and implemented as documented; cost-only scope is clear; ranking and bands are consistent with engine. Only minor label/copy improvements recommended.
- **Forecasting:** **High** — Exposure block is from forward exposure engine; peak is correct; pressure/trajectory block is from risk forecast/momentum. Units (cost) and engine boundary can be made explicit with short copy edits.
