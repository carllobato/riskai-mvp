import { supabaseBrowserClient } from "@/lib/supabase/browser";
import type { RiskRow } from "@/types/risk";
import type { Risk } from "@/domain/risk/risk.schema";
import { buildRating } from "@/domain/risk/risk.logic";
import { costToConsequenceScale, timeDaysToConsequenceScale } from "@/domain/risk/risk.logic";

/** Default project UUID used when no projectId is provided (legacy single-project flow). */
export const DEFAULT_PROJECT_ID = "a8995152-7065-4f79-ab8a-015b6ab0a3ec";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_REGEX.test(s);
}

/**
 * Map a DB row to domain Risk (for listRisks).
 * Uses extended columns when present so saved risks restore with full form data.
 */
function rowToRisk(row: RiskRow): Risk {
  const preConsequence = Math.max(
    costToConsequenceScale(row.pre_cost_ml),
    timeDaysToConsequenceScale(row.pre_time_ml)
  );
  const postConsequence = Math.max(
    costToConsequenceScale(row.post_cost_ml),
    timeDaysToConsequenceScale(row.post_time_ml)
  );
  const appliesTo = (row.applies_to === "time" || row.applies_to === "cost" || row.applies_to === "both")
    ? row.applies_to
    : undefined;
  // When there is no mitigation text, DB may store 0 for post_* (riskToRow writes 0 for NOT NULL cols).
  // Return undefined for all post-mitigation fields so the in-memory risk matches buildUpdatedRisk
  // (no mitigation → undefined) and the dirty check does not false-positive after save/reload.
  const hasMitigation = Boolean(row.mitigation_description?.trim());
  return {
    id: row.id,
    riskNumber: row.risk_number ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    category: row.category as Risk["category"],
    status: row.status as Risk["status"],
    owner: row.owner ?? undefined,
    mitigation: row.mitigation_description ?? undefined,
    inherentRating: buildRating(row.pre_probability, preConsequence),
    residualRating: buildRating(row.post_probability, postConsequence),
    appliesTo,
    preMitigationProbabilityPct: row.pre_probability_pct ?? undefined,
    preMitigationCostMin: row.pre_cost_min ?? undefined,
    preMitigationCostML: row.pre_cost_ml,
    preMitigationCostMax: row.pre_cost_max ?? undefined,
    preMitigationTimeMin: row.pre_time_min ?? undefined,
    preMitigationTimeML: row.pre_time_ml,
    preMitigationTimeMax: row.pre_time_max ?? undefined,
    mitigationCost: hasMitigation ? row.mitigation_cost : undefined,
    postMitigationProbabilityPct: hasMitigation ? (row.post_probability_pct ?? undefined) : undefined,
    postMitigationCostMin: hasMitigation ? (row.post_cost_min ?? undefined) : undefined,
    postMitigationCostML: hasMitigation ? (row.post_cost_ml ?? undefined) : undefined,
    postMitigationCostMax: hasMitigation ? (row.post_cost_max ?? undefined) : undefined,
    postMitigationTimeMin: hasMitigation ? (row.post_time_min ?? undefined) : undefined,
    postMitigationTimeML: hasMitigation ? (row.post_time_ml ?? undefined) : undefined,
    postMitigationTimeMax: hasMitigation ? (row.post_time_max ?? undefined) : undefined,
    baseCostImpact: row.base_cost_impact ?? undefined,
    costImpact: row.cost_impact ?? undefined,
    scheduleImpactDays: row.schedule_impact_days ?? undefined,
    probability: row.probability ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    scoreHistory: [],
  };
}

/**
 * Map domain Risk to DB insert row. Writes all app fields so the table can store full form data.
 * DB id column is uuid; use risk.id only if already a valid UUID, else generate one for insert.
 */
function riskToRow(risk: Risk, projectId: string): Omit<RiskRow, "project_id"> & { project_id: string } {
  const preCostMl = risk.preMitigationCostML;
  const preTimeMl = risk.preMitigationTimeML;
  const mitigationCost = risk.mitigationCost;
  const postCostMl = risk.postMitigationCostML;
  const postTimeMl = risk.postMitigationTimeML;
  const rowId = isUuid(risk.id) ? risk.id : crypto.randomUUID();
  return {
    id: rowId,
    project_id: projectId,
    title: risk.title,
    description: risk.description ?? null,
    category: risk.category,
    owner: risk.owner ?? null,
    status: risk.status,
    pre_probability: Number(risk.inherentRating.probability),
    pre_cost_ml: Number(preCostMl ?? 0),
    pre_time_ml: Number(preTimeMl ?? 0),
    mitigation_description: risk.mitigation ?? null,
    mitigation_cost: Number(mitigationCost ?? 0),
    post_probability: Number(risk.residualRating.probability),
    post_cost_ml: Number(postCostMl ?? 0),
    post_time_ml: Number(postTimeMl ?? 0),
    created_at: risk.createdAt,
    updated_at: risk.updatedAt,
    risk_number: risk.riskNumber ?? null,
    applies_to: risk.appliesTo ?? null,
    pre_probability_pct: risk.preMitigationProbabilityPct ?? null,
    pre_cost_min: risk.preMitigationCostMin ?? null,
    pre_cost_max: risk.preMitigationCostMax ?? null,
    pre_time_min: risk.preMitigationTimeMin ?? null,
    pre_time_max: risk.preMitigationTimeMax ?? null,
    post_probability_pct: risk.postMitigationProbabilityPct ?? null,
    post_cost_min: risk.postMitigationCostMin ?? null,
    post_cost_max: risk.postMitigationCostMax ?? null,
    post_time_min: risk.postMitigationTimeMin ?? null,
    post_time_max: risk.postMitigationTimeMax ?? null,
    base_cost_impact: risk.baseCostImpact ?? null,
    cost_impact: risk.costImpact ?? null,
    schedule_impact_days: risk.scheduleImpactDays ?? null,
    probability: risk.probability ?? null,
  };
}

/**
 * Fetch all risks for the active project, ordered by created_at ascending.
 * Returns domain Risk[] for use in the store.
 * @param projectId - Optional project UUID; when omitted uses default (legacy single-project).
 */
export async function listRisks(projectId?: string): Promise<Risk[]> {
  const pid = projectId ?? DEFAULT_PROJECT_ID;
  const supabase = supabaseBrowserClient();
  const { data, error } = await supabase
    .from("risks")
    .select("*")
    .eq("project_id", pid)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[risks] listRisks", error);
    throw new Error(error.message ?? "Failed to load risks from database");
  }
  const rows = (data ?? []) as RiskRow[];
  return rows.map(rowToRisk);
}

/**
 * Replace all risks for the active project: delete existing, then insert the given list.
 * Returns the inserted risks (with DB-assigned ids for rows that had non-UUID ids) so the
 * client can merge local-only fields by position and avoid losing data for newly created risks.
 * @param projectId - Optional project UUID; when omitted uses default (legacy single-project).
 */
export async function replaceRisks(risks: Risk[], projectId?: string): Promise<Risk[]> {
  const pid = projectId ?? DEFAULT_PROJECT_ID;
  const supabase = supabaseBrowserClient();

  const { error: deleteError } = await supabase
    .from("risks")
    .delete()
    .eq("project_id", pid);

  if (deleteError) {
    console.error("[risks] replaceRisks delete", deleteError);
    throw new Error(deleteError.message ?? "Failed to save risks (delete step)");
  }

  if (risks.length === 0) return [];

  const rows = risks.map((r) => riskToRow(r, pid));

  const { data: insertedRows, error: insertError } = await supabase
    .from("risks")
    .insert(rows)
    .select();

  if (insertError) {
    console.error("[risks] replaceRisks insert", insertError);
    throw new Error(insertError.message ?? "Failed to save risks (insert step)");
  }

  const inserted = (insertedRows ?? []) as RiskRow[];
  if (inserted.length !== rows.length) {
    throw new Error(
      `Failed to save risks: expected ${rows.length} rows back, got ${inserted.length}. Some rows may have been rejected by constraints.`
    );
  }
  // Return risks in the same order as input. SQL does not guarantee order without ORDER BY,
  // so reorder by the id we sent for each position so the client can safely merge by index.
  const byId = new Map(inserted.map((r) => [r.id, r]));
  return rows.map((row) => {
    const matched = byId.get(row.id);
    if (!matched) {
      throw new Error(
        `Failed to save risks: inserted response missing row for id ${row.id}.`
      );
    }
    return rowToRisk(matched);
  });
}
