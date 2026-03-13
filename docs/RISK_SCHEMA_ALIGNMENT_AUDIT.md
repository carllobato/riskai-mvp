# Risk schema alignment audit: Supabase `public.risks` vs application

**Date:** 2025-03-11  
**Scope:** Risk type definitions, DB mapping, validation, and Monte Carlo simulation input requirements.

---

## 1. Risk schema definition locations

| Location | What is defined | Purpose |
|----------|-----------------|---------|
| **`src/types/risk.ts`** | `RiskRow`, `RiskInput` | DB row shape (snake_case, matches Supabase); UI/form input shape for insert. |
| **`src/domain/risk/risk.schema.ts`** | `Risk` (Zod `RiskSchema`), `RiskDraft`, `IntelligentExtractDraft` | Canonical domain Risk (camelCase); AI draft schemas. |
| **`src/domain/risk/risk-merge.types.ts`** | `MergeRiskDraft`, cluster/request/response types | AI merge review payloads. |
| **`src/domain/simulation/monteCarlo.ts`** | `EffectiveRiskInputs` | Simulation input per risk (probability 0–1, costML, timeML only). |
| **`src/domain/simulation/simulation.types.ts`** | `SimulationRiskSnapshot`, `SimulationSnapshot` | Simulation result shapes; not DB. |
| **`src/lib/db/risks.ts`** | `rowToRisk(row: RiskRow): Risk`, `riskToRow(risk: Risk, projectId): row` | **Single mapping layer** between DB rows and domain Risk. |

**Canonical domain type:** `Risk` from `src/domain/risk/risk.schema.ts` (Zod-inferred).  
**DB boundary type:** `RiskRow` in `src/types/risk.ts`. All DB reads/writes go through `rowToRisk` / `riskToRow` in `src/lib/db/risks.ts`.

---

## 2. Field name alignment check

### 2.1 Database columns (snake_case) → Domain Risk (camelCase)

Mapping is **centralized** in `src/lib/db/risks.ts`:

| Supabase column | RiskRow field | Domain Risk field | Notes |
|-----------------|---------------|-------------------|--------|
| `pre_probability` | `pre_probability` | derived → `inherentRating.probability` (1–5) | Stored from rating scale. |
| `pre_probability_pct` | `pre_probability_pct` | `preMitigationProbabilityPct` | 0–100 %; added by migration. |
| `pre_cost_min` | `pre_cost_min` | `preMitigationCostMin` | ✓ |
| `pre_cost_ml` | `pre_cost_ml` | `preMitigationCostML` | ✓ |
| `pre_cost_max` | `pre_cost_max` | `preMitigationCostMax` | ✓ |
| `pre_time_min` | `pre_time_min` | `preMitigationTimeMin` | ✓ |
| `pre_time_ml` | `pre_time_ml` | `preMitigationTimeML` | ✓ |
| `pre_time_max` | `pre_time_max` | `preMitigationTimeMax` | ✓ |
| `mitigation_description` | `mitigation_description` | `mitigation` | DB column name differs from domain property name; mapping handles it. |
| `mitigation_cost` | `mitigation_cost` | `mitigationCost` | ✓ |
| `post_probability` | `post_probability` | derived → `residualRating.probability` (1–5) | Stored from rating scale. |
| `post_probability_pct` | `post_probability_pct` | `postMitigationProbabilityPct` | 0–100 %; added by migration. |
| `post_cost_min` / `post_cost_ml` / `post_cost_max` | same | `postMitigationCostMin` / `ML` / `Max` | ✓ |
| `post_time_min` / `post_time_ml` / `post_time_max` | same | `postMitigationTimeMin` / `ML` / `Max` | ✓ |

**Conclusion:** There are **no naming mismatches** at the DB boundary. The app uses camelCase in domain and UI; the DB uses snake_case. `RiskRow` and `rowToRisk` / `riskToRow` are consistent with each other and with the migration.

### 2.2 AI / draft schemas (not DB)

- **IntelligentExtractDraftSchema** uses camelCase (`postCostMostLikely`, `postTimeMostLikely`, etc.). This is the AI response shape; `intelligentDraftToRisk()` in `risk.mapper.ts` maps it to domain `Risk` (which then persists via `riskToRow` using snake_case). No DB column names are used in the draft schema.
- **MergeRiskDraft** and merge API use domain-style camelCase; again, persistence goes through `riskToRow`.

---

## 3. Mismatches found

### 3.1 Column names: **none**

- All Supabase column names used in code match the names in `RiskRow` and in `rowToRisk` / `riskToRow`.
- Domain uses `mitigation`; DB uses `mitigation_description`. The mapping layer translates (`row.mitigation_description` → `risk.mitigation`, `risk.mitigation` → `row.mitigation_description`). No change needed.

### 3.2 Columns your list may be missing (vs migration)

You listed the base + extended numeric columns but **not**:

- **`pre_probability_pct`**
- **`post_probability_pct`**

These are added in `supabase/migrations/20250311_risks_add_app_fields.sql` and are used by:

- **`src/lib/db/risks.ts`:** read in `rowToRisk`, written in `riskToRow`.
- **`src/types/risk.ts`:** optional on `RiskRow`.
- **Runnable validator** (`src/domain/risk/runnable-risk.validator.ts`): expects `preMitigationProbabilityPct` and (when mitigation exists) `postMitigationProbabilityPct` in **0–100** range. These come from `pre_probability_pct` / `post_probability_pct` after mapping. If those columns are missing, loaded risks get `undefined` for the % fields and validation fails until the migration is applied.

So: **no naming mismatch**, but **schema completeness** depends on having the migration applied (including `pre_probability_pct` and `post_probability_pct`).

### 3.3 Optional columns used in code (RiskRow) vs your list

Your list already includes the extended columns. The code also expects these optional columns (all in the same migration):

- `risk_number`, `applies_to`
- `base_cost_impact`, `cost_impact`, `schedule_impact_days`, `probability`

They are optional in `RiskRow` and in the migration (`ADD COLUMN IF NOT EXISTS`). If absent, the app still runs; optional fields become `undefined`/`null` and fallbacks are used (e.g. in `getEffectiveRiskInputs`).

---

## 4. Fields used in code that do NOT exist in Supabase (if only base table exists)

If the **migration has not** been run, the app still **writes** these in `riskToRow` (so insert could fail or columns missing):

- `pre_probability_pct`, `post_probability_pct`
- `pre_cost_min`, `pre_cost_max`, `pre_time_min`, `pre_time_max`
- `post_cost_min`, `post_cost_max`, `post_time_min`, `post_time_max`
- `risk_number`, `applies_to`
- `base_cost_impact`, `cost_impact`, `schedule_impact_days`, `probability`

**Recommendation:** Run `supabase/migrations/20250311_risks_add_app_fields.sql` so the table has all columns the app reads/writes. No code change required for alignment.

---

## 5. Supabase fields that are unused in code

**None.** Every column you listed is used:

- Core: `id`, `project_id`, `title`, `description`, `category`, `owner`, `status` — all used in `rowToRisk` / `riskToRow`.
- Pre/post and mitigation: all used and mapped to domain Risk and simulation/validation.

Optional migration columns (`risk_number`, `applies_to`, `base_cost_impact`, etc.) are also read and written in `src/lib/db/risks.ts` and typed in `RiskRow`.

---

## 6. Validation logic vs fields

**Runnable validator:** `src/domain/risk/runnable-risk.validator.ts`

- **Pre-mitigation:** expects `preMitigationProbabilityPct` (0–100), `preMitigationCostMin/ML/Max` (≥0, min ≤ ML ≤ max), `preMitigationTimeMin/ML/Max` (same). All of these are populated from DB via `rowToRisk` when the corresponding Supabase columns exist (including migration columns).
- **Post-mitigation:** when `risk.mitigation` is non-empty, same rules for `postMitigation*` fields.
- **Draft:** risks with `status === "draft"` are skipped (no errors).

**Missing fields:** If `pre_probability_pct` / `post_probability_pct` are not in the DB, they are `undefined` after load; the validator then reports “Pre-mitigation probability % must be 0–100” (and similarly for post when mitigation is set). So validation **does** expect the migration columns for runnable checks to pass after load.

**Simulation** does **not** use min/max: `getEffectiveRiskInputs()` and `EffectiveRiskInputs` use only:

- probability (0–1, derived from % or rating),
- costML,
- timeML.

So simulation input requirements are satisfied by the existing mapping. Min/max are for UI and runnable validation only.

---

## 7. Recommended fixes (minimum change)

1. **Ensure migration is applied**  
   Run `supabase/migrations/20250311_risks_add_app_fields.sql` so the table has:
   - `pre_probability_pct`, `post_probability_pct`
   - All pre/post min/max columns
   - `risk_number`, `applies_to`, `base_cost_impact`, `cost_impact`, `schedule_impact_days`, `probability`

2. **No mapping or renames required**  
   - Keep DB columns as snake_case.  
   - Keep domain and UI as camelCase.  
   - Keep using `RiskRow` + `rowToRisk` / `riskToRow` as the single boundary. No change to simulation or validation logic.

3. **Optional: derive % from 1–5 scale when % column is null**  
   If you must support DBs that will never have `pre_probability_pct` / `post_probability_pct`, you could in `rowToRisk` set:
   - `preMitigationProbabilityPct: row.pre_probability_pct ?? (row.pre_probability != null ? (row.pre_probability / 5) * 100 : undefined)`
   - and similarly for post.  
   This would be a **code-only** change in `src/lib/db/risks.ts` so that runnable validation and simulation still work when the % columns are missing. Prefer adding the columns via migration instead, so 0–100 is stored explicitly.

---

## 8. Confirmation: database schema vs simulation input requirements

- **Pre-mitigation:** Simulation needs probability (0–1), cost ML, time ML. These are supplied from:
  - `pre_probability_pct` (or fallback from `pre_probability` and rating in `getEffectiveRiskInputs`),
  - `pre_cost_ml`, `pre_time_ml`,
  - and optionally the min/max columns for validation only.  
  **Compatible** once the mapping (and optionally migration) is in place.

- **Post-mitigation:** When mitigation exists, same: `post_probability_pct` (or fallback), `post_cost_ml`, `post_time_ml`.  
  **Compatible.**

- **Monte Carlo** uses only `EffectiveRiskInputs` (probability, costML, timeML). It does **not** use min/max. So the current DB schema (with base + migration columns) is **compatible** with simulation input requirements; no simulation logic changes are required.

---

## Summary

| Item | Status |
|------|--------|
| Risk schema definition locations | Listed in §1; single canonical `Risk` and `RiskRow` + mapping in `risks.ts`. |
| Field name alignment (DB ↔ code) | Aligned; snake_case at DB, camelCase in app; mapping layer consistent. |
| Naming mismatches | None (including `mitigation_description` ↔ `mitigation`). |
| Code-only fields (not in DB) | None; all used fields exist in Supabase after migration. |
| Unused DB fields | None. |
| Validation expecting missing fields | Only if migration not applied (`pre_probability_pct` / `post_probability_pct`). |
| Minimum fix | Apply migration; no code changes required for alignment. Optional: derive % from 1–5 in `rowToRisk` if % columns cannot be added. |
| Simulation compatibility | Yes; simulation only needs probability and cost/time ML, all provided by current mapping (and DB columns). |
