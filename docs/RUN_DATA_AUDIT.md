# Run Data Page — Audit vs Required Data Contract

**Date:** 2025-03-14  
**Scope:** Rename Outputs → Run Data complete; audit of current fields vs required minimum contract. No refactors yet.

---

## 1. Files changed for the rename

| File | Change |
|------|--------|
| `app/(protected)/run-data/page.tsx` | **New.** Run Data page (content moved from Outputs, title "Run Data", `RunDataPage` / `RunDataPageProps`, `[run-data]` log tag). |
| `app/(protected)/projects/[projectId]/run-data/page.tsx` | **New.** Project-scoped Run Data route; renders `RunDataPage` with `projectId`. |
| `app/(protected)/outputs/page.tsx` | **Replaced.** Now client redirect to `/run-data`. |
| `app/(protected)/projects/[projectId]/outputs/page.tsx` | **Replaced.** Now client redirect to `/projects/[projectId]/run-data`. |
| `src/components/NavBar.tsx` | Outputs nav item replaced with Run Data; `projectSlug` and `href` updated; `/run-data` added to `isKnownAppRoute`. |
| `src/components/ProjectSwitcher.tsx` | `SUBPAGES`: `"outputs"` → `"run-data"`. |
| `app/(protected)/simulation/SimulationPageContent.tsx` | Link href and label: `/outputs` → `/run-data`, "Go to Outputs" → "Go to Run Data". |
| `app/(protected)/projects/[projectId]/ProjectOverviewContent.tsx` | Empty/helper copy: "Outputs page" → "Run Data page", "Outputs for exposure" → "Run Data for exposure". |
| `app/(protected)/matrix/page.tsx` | Comment only: "redirect to Outputs" → "redirect to Run Data when shown". |
| `src/store/risk-register.store.tsx` | Comment: "Outputs tiles" → "Run Data tiles". |
| `src/components/outputs/OutputsSection.tsx` | Comment: `app/outputs/page.tsx` → `app/run-data/page.tsx`. |

---

## 2. Files where the temporary navigation item was added

| File | What was added |
|------|----------------|
| `src/components/NavBar.tsx` | New nav entry: `{ href: "/run-data", projectSlug: "run-data", label: "Run Data" }` with comment: `// TEMP: Run Data nav item for development audit – remove before production`. Placed immediately before Simulation. No `hideInMvp` so it is visible in MVP. |

---

## 3. Current fields already available on the Run Data page

Data is derived from:

- **Store:** `useRiskRegister()` → `simulation.current`, `simulation.scenarioSnapshots`, `simulation.neutral`, `risks`, `forwardPressure`, `riskForecastsById`.
- **Neutral snapshot:** `scenarioSnapshots?.neutral ?? current` → `SimulationSnapshot` (and optionally `simulation.neutral` for Monte Carlo detail).

### Run metadata (partial)

| Field | Source | Notes |
|-------|--------|--------|
| Run id | `current?.id` | From `makeId("sim")` or DB restore; not a stable DB run id. |
| Project id | URL / `projectId` prop | Not part of run payload; from route or storage. |
| Run timestamp | `current?.timestampIso` | Set at run time or from snapshot `created_at`. |
| Iteration count | `current?.iterations`, `neutral?.iterationCount` | Present. |
| Status | — | No explicit run status (e.g. "completed", "failed"). |

### Core outputs (partial)

| Field | Source | Notes |
|-------|--------|--------|
| Total residual risk exposure | `selectedResult?.total` (forward exposure), or `snapshotNeutral?.totalExpectedCost` | Forward exposure total vs snapshot mean; "residual" not explicitly labelled. |
| Contingency held | — | Not on Run Data page; comes from Project Settings / `projectContext` and is used on Overview only. |
| Coverage ratio | — | Not on Run Data page; Overview computes as contingencyHeld / residualExposure. |

### Cost outputs

| Field | Source | Notes |
|-------|--------|--------|
| Cost P20 | `baselineSummaryNeutral.p20Cost` (from snapshot) | Shown as "P20". |
| Cost P50 | `baselineSummaryNeutral.p50Cost` | ✓ |
| Cost P80 | `baselineSummaryNeutral.p80Cost` | ✓ |
| Cost P90 | `baselineSummaryNeutral.p90Cost` | ✓ |
| Contract asks **cost p10** | — | App uses **P20** in UI and in `SimulationSnapshot`; DB stores **p10_cost** (mapped to `p20Cost` in store). |

### Schedule outputs

| Field | Source | Notes |
|-------|--------|--------|
| Schedule P20/P50/P80/P90 | `neutralMc?.summary.p20Time`, `p50Time`, `p80Time`, `p90Time` | From Monte Carlo neutral summary. |

### Driver outputs

| Field | Source | Notes |
|-------|--------|--------|
| Top cost risks | `selectedResult?.topDrivers` (forward exposure, top 5) | By scenario; not explicitly "ranked cost risks" by cost percentile. |
| Top schedule risks | — | Not on Run Data page; Overview derives from risks (scheduleImpactDays etc.), not from run. |

### Distribution outputs

| Field | Source | Notes |
|-------|--------|--------|
| Histogram / chart source | `neutralMc?.costSamples`, `neutralMc?.timeSamples` | In store only; Run Data page does **not** render histogram/CDF. Monthly exposure chart uses `selectedResult?.monthlyTotal`, `aggressive?.monthlyTotal` (forward exposure). |

### Reporting controls

| Field | Source | Notes |
|-------|--------|--------|
| Locked for report | — | Not present. |
| Official run | — | Not present. |

---

## 4. Missing fields against the required minimum contract

| Contract field | Status |
|----------------|--------|
| **Run metadata** | |
| run id | Partial: `current.id` is in-memory; no persistent run id from DB. |
| project id | In URL/context only; not part of run payload. |
| run timestamp | ✓ `timestampIso`. |
| iteration count | ✓ |
| status | **Missing** (e.g. completed / failed). |
| **Core outputs** | |
| total residual risk exposure | Partial: forward exposure total and snapshot mean exist; "residual" and single canonical field not defined. |
| contingency held | **Missing on Run Data** (lives in project context; Overview only). |
| coverage ratio | **Missing on Run Data** (Overview only). |
| **Cost** | |
| cost p10 | **Naming mismatch:** contract wants p10; app uses **p20** in snapshot/UI; DB has **p10_cost** (mapped to p20Cost). |
| cost p50, p80, p90 | ✓ Present. |
| **Schedule** | |
| schedule p10, p50, p80, p90 | Present as p20/p50/p80/p90 from neutral summary. |
| **Driver outputs** | |
| top cost risks | Partial: "Top 5 drivers" from forward exposure; not explicitly "ranked cost risks" from run. |
| top schedule risks | **Missing on Run Data** (Overview has its own derivation from risks). |
| **Distribution** | |
| histogram / chart source data | In store (`costSamples`, `timeSamples`) but **not exposed or rendered** on Run Data page. |
| **Reporting** | |
| locked for report flag | **Missing.** |
| official run flag | **Missing.** |

---

## 5. Duplicate or inconsistent fields to rationalise later

- **P10 vs P20:** DB and contract say "p10"; `SimulationSnapshot` and Run Data UI use **p20Cost** (and store maps DB `p10_cost` → `p20Cost`). Unify naming (either p10 everywhere or p20 everywhere) and document.
- **Run identity:** `current.id` is ephemeral; DB snapshot row has `id` but it is not wired back as "run id" on the page. Consider a single canonical run id (e.g. snapshot row id).
- **Total residual risk exposure:** Two notions: (1) forward exposure `selectedResult.total`, (2) snapshot `totalExpectedCost` (mean). Overview uses `exposure?.total` (recomputed). Decide one source for "total residual risk exposure" for the contract.
- **Contingency and coverage ratio:** Only on Overview (from project context). Run Data does not show them; contract expects them on the run data source. Either surface on Run Data or formally define Run Data as "run outputs" and Overview as consumer that joins with project context.
- **Top schedule risks:** Overview derives from risks (scheduleImpactDays etc.); Run Data has no "ranked schedule risks" from the run. Contract expects "top schedule risks" as run output; need a single definition and source.
- **Histogram/CDF data:** Present in `simulation.neutral.costSamples` / `timeSamples` and used on Analysis; not shown on Run Data. Contract expects "histogram / chart source data" on Run Data; either expose here or document that Analysis is the consumer.
- **Project Overview vs Run Data:** Overview uses `latestSnapshot` from DB + recomputed `computePortfolioExposure(risks, "neutral")`; Run Data uses in-memory `simulation.current` / `scenarioSnapshots` / `neutral`. Same run can appear differently (e.g. after reload Overview from DB, Run Data from store). Rationalise so one source of truth (e.g. run data from DB or from store) and others consume it.
- **createSnapshot payload:** Store passes `s.p20Cost` as `p10_cost`, `s.p20Time` as `p10_time` to DB. Naming is inconsistent (p20 in app, p10 in DB).

---

## 6. What to review in the browser

1. **Navigation**  
   - Top nav shows **Run Data** next to Simulation (with TEMP comment in code).  
   - From a project, **Run Data** goes to `/projects/[id]/run-data`.  
   - From project list, **Run Data** goes to `/projects` (same as other project-scoped links).

2. **Routes**  
   - `/run-data` and `/projects/[projectId]/run-data` render the Run Data page (title "Run Data").  
   - `/outputs` and `/projects/[projectId]/outputs` redirect to the corresponding Run Data URLs.

3. **Simulation page**  
   - "Go to Run Data" link points to `/projects/[id]/run-data` and label is "Go to Run Data".

4. **Project Overview**  
   - Empty states and helper text say "Run Data page" and "Run Data for exposure".

5. **Run Data page content**  
   - After running a simulation: Project Cost (P20/P50/P80/P90/Mean), Programme (P20/P50/P80/P90), Scenario Exposure, Forecast Summary, Mitigation panel.  
   - No run id, status, contingency, coverage ratio, or report lock/official flags.  
   - No histogram/CDF; only monthly exposure chart and top 5 drivers.

6. **Project switcher**  
   - Switching project keeps subpage; "run-data" is a valid subpage so URL becomes `/projects/[newId]/run-data`.

---

**Next steps (not done in this task):**  
- Add missing contract fields (status, contingency, coverage ratio, top schedule risks, histogram source, locked/official flags).  
- Resolve P10 vs P20 and run id/source of truth.  
- Rationalise Overview vs Run Data data sources and remove duplication.
