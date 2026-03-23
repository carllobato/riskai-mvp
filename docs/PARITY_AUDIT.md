# Outputs vs Analysis — Parity Audit

## Methodology (parity mode)

- **Snapshot**: Use **neutral** only (`state.simulation.neutral` for summary percentiles; `state.simulation.current` for snapshot values).
- **Risks**: Exclude **Closed** risks from all calculations.
- **Inputs**: Use **post-mitigation** when present, else **pre-mitigation** (per risk, per field).
- **Percentiles**: Must come from **summary.pXXCost** / **summary.pXXTime** (Monte Carlo combined distribution), not mean/expected.
- **Units**: Cost in **USD ($)**; time in **days** (display: "X days" or "X weeks" via `formatDurationDays`).

---

## Mapping: Page → Section → Field → Source → Formatter

### Outputs page (`app/outputs/page.tsx`)

| Section / Tile label | Field | Selector / path | Source snapshot | Formatter |
|----------------------|--------|------------------|------------------|-----------|
| Project Cost (Baseline – Neutral) · P20 | p20Cost | `baselineSummaryNeutral.p20Cost` ← `snapshotNeutral.p20Cost` | neutral (`current`) | `formatCost` (USD) |
| Project Cost (Baseline – Neutral) · P50 | p50Cost | `baselineSummaryNeutral.p50Cost` ← `snapshotNeutral.p50Cost` | neutral | `formatCost` (USD) |
| Project Cost (Baseline – Neutral) · P80 | p80Cost | `baselineSummaryNeutral.p80Cost` ← `snapshotNeutral.p80Cost` | neutral | `formatCost` (USD) |
| Project Cost (Baseline – Neutral) · P90 | p90Cost | `baselineSummaryNeutral.p90Cost` ← `snapshotNeutral.p90Cost` | neutral | `formatCost` (USD) |
| Project Cost (Baseline – Neutral) · Mean | totalExpectedCost | `baselineSummaryNeutral.totalExpectedCost` ← `snapshotNeutral.totalExpectedCost` | neutral | `formatCost` (USD) |
| Programme (Baseline – Neutral) · P20 | p20Time | `neutralMc.summary.p20Time` | `state.simulation.neutral.summary` | `formatDurationDays` |
| Programme (Baseline – Neutral) · P50 | p50Time | `neutralMc.summary.p50Time` | `state.simulation.neutral.summary` | `formatDurationDays` |
| Programme (Baseline – Neutral) · P80 | p80Time | `neutralMc.summary.p80Time` | `state.simulation.neutral.summary` | `formatDurationDays` |
| Programme (Baseline – Neutral) · P90 | p90Time | `neutralMc.summary.p90Time` | `state.simulation.neutral.summary` | `formatDurationDays` |
| Baseline Exposure (tiles/chart) | total, monthlyTotal, topDrivers | `forwardExposure.result` | **neutral baseline** | `formatCost` (USD) |

**Note**: Project Cost, Programme, and Baseline Exposure all use the neutral baseline.

### Analysis page (`app/analysis/page.tsx`)

| Section / Tile label | Field | Selector / path | Source snapshot | Formatter |
|----------------------|--------|------------------|------------------|-----------|
| Baseline P20 (Neutral) | p20Cost | `getNeutralSummary(state).p20Cost` (neutral.summary.p20Cost or snap.p20Cost) | neutral | `formatCost` (USD) |
| Baseline P50 (Neutral) | p50Cost | `getNeutralSummary(state).p50Cost` ← snap.p50Cost | neutral | `formatCost` (USD) |
| Baseline P80 (Neutral) | p80Cost | `getNeutralSummary(state).p80Cost` ← snap.p80Cost | neutral | `formatCost` (USD) |
| Baseline P90 (Neutral) | p90Cost | `getNeutralSummary(state).p90Cost` ← snap.p90Cost | neutral | `formatCost` (USD) |
| Expected Cost (Mean) | totalExpectedCost | `getNeutralSummary(state).totalExpectedCost` ← snap.totalExpectedCost | neutral | `formatCost` (USD) |
| Schedule (P20) | p20Time | `getNeutralSummary(state).p20Time` ← neutral.summary.p20Time | neutral.summary | `formatDurationDays` |
| Schedule (P50) | p50Time | `getNeutralSummary(state).p50Time` ← neutral.summary.p50Time | neutral.summary | `formatDurationDays` |
| Schedule (P80) | p80Time | `getNeutralSummary(state).p80Time` ← neutral.summary.p80Time | neutral.summary | `formatDurationDays` |
| Schedule (P90) | p90Time | `getNeutralSummary(state).p90Time` ← neutral.summary.p90Time | neutral.summary | `formatDurationDays` |
| Cost Distribution chart / tooltip | cost at deciles | from `neutralSummary` + samples or derived percentiles | neutral | `formatCost` (USD) |
| Time Distribution chart / tooltip | time at deciles | from `timeSummary` / timeSamples | neutral.summary / neutral.timeSamples | `formatDurationDays` |
| Cumulative Probability chart | p50Cost, p80Cost, target | `neutralSummary.p50Cost`, `neutralSummary.p80Cost`, `targetPCost` | neutral | `formatCost` (USD) |
| Math Audit (Debug) | costPercentiles, programmePercentiles | `getAnalysisAudit(state)` → neutral.summary | neutral.summary | `formatCost`, `formatDurationDays` |

---

## Findings and fixes

1. **Cost percentiles source**: Both pages now use the same lineage. Snapshot is built from `buildSimulationSnapshotFromResult(mcResult, …)`, which sets `p20Cost`, `p50Cost`, `p80Cost`, `p90Cost` from `result.summary`. `state.simulation.current` and `state.simulation.neutral.summary` are in sync for a given run.
2. **Schedule percentiles**: Analysis already used `neutral.summary.pXXTime`. Outputs MVP did not show schedule; **Programme (Baseline – Neutral)** row was added to Outputs using `state.simulation.neutral.summary` (P20/P50/P80/P90) so both pages show the same programme values.
3. **P20 cost**: Added to Monte Carlo `summary` and `SimulationSnapshot`; both pages now show P20 cost in parity mode.
4. **P90 cost on Analysis**: Analysis now has a **Baseline P90 (Neutral)** tile; cost tiles are P20/P50/P80/P90 + Mean on both pages.
5. **Currency**: Analysis previously used `fmtMoney` (AUD) in chart tooltips; all cost display now uses `formatCost` (USD) for canonical units.
6. **No Px tile uses mean/expected**: P20/P50/P80/P90 tiles use only `summary.pXXCost` / `summary.pXXTime`; Mean/Expected is a separate tile and labelled as such.

---

## Intentional differences (labelled)

- **Forward Exposure / Top drivers**: Neutral baseline only.

---

## Single-risk deterministic sanity check

**Setup**: One risk, 100% probability, 10 days time impact (and any cost). No randomness.

**Expected**: All schedule percentiles (P20, P50, P80, P90) = **10 days** (every iteration sums to 10 days).

**How to run** (e.g. in tests or manually):

1. Create one risk: post-mitigation (or pre) probability = 100%, time impact = 10 days.
2. Run Monte Carlo with a fixed seed (or sufficient iterations).
3. Assert `neutral.summary.p20Time === 10`, `p50Time === 10`, `p80Time === 10`, `p90Time === 10`.

**Test**: `src/domain/simulation/monteCarlo.test.ts` — test name: *"deterministic single risk 100% prob 10 days: all schedule percentiles equal 10"*. Run with: `npx tsx --test src/domain/simulation/monteCarlo.test.ts`.

---

## Dev-only: ParityAuditPanel

A **ParityAuditPanel** component (rendered only in development) compares raw values used by Outputs and Analysis from the same state and highlights mismatches with `!==` before formatting. Use it to confirm that in parity mode both pages show identical raw numbers for Cost P20/P50/P80/P90 and Schedule P20/P50/P80/P90.
