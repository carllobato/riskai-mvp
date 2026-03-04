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
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    category: row.category as Risk["category"],
    status: row.status as Risk["status"],
    owner: row.owner ?? undefined,
    mitigation: row.mitigation_description ?? undefined,
    inherentRating: buildRating(row.pre_probability, preConsequence),
    residualRating: buildRating(row.post_probability, postConsequence),
    preMitigationCostML: row.pre_cost_ml,
    preMitigationTimeML: row.pre_time_ml,
    mitigationCost: row.mitigation_cost,
    postMitigationCostML: row.post_cost_ml,
    postMitigationTimeML: row.post_time_ml,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    scoreHistory: [],
  };
}

/**
 * Map domain Risk to DB insert row. Ensures numeric fields are numbers; mitigation_cost defaults to 0.
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
  };
}

/**
 * Fetch all risks for the active project, ordered by created_at ascending.
 * Returns domain Risk[] for use in the store.
 * @param projectId - Optional project UUID; when omitted uses default (legacy single-project).
 */
export async function listRisks(projectId?: string): Promise<Risk[]> {
  const pid = projectId ?? DEFAULT_PROJECT_ID;
  try {
    const supabase = supabaseBrowserClient();
    const { data, error } = await supabase
      .from("risks")
      .select("*")
      .eq("project_id", pid)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[risks]", error);
      return [];
    }
    const rows = (data ?? []) as RiskRow[];
    return rows.map(rowToRisk);
  } catch (error) {
    console.error("[risks]", error);
    return [];
  }
}

/**
 * Replace all risks for the active project: delete existing, then insert the given list.
 * Converts domain Risk[] to rows and sets project_id and mitigation_cost default.
 * @param projectId - Optional project UUID; when omitted uses default (legacy single-project).
 */
export async function replaceRisks(risks: Risk[], projectId?: string): Promise<void> {
  const pid = projectId ?? DEFAULT_PROJECT_ID;
  try {
    const supabase = supabaseBrowserClient();

    const { error: deleteError } = await supabase
      .from("risks")
      .delete()
      .eq("project_id", pid);

    if (deleteError) {
      console.error("[risks]", deleteError);
      throw deleteError;
    }

    if (risks.length === 0) return;

    const rows = risks.map((r) => riskToRow(r, pid));

    const { error: insertError } = await supabase.from("risks").insert(rows);

    if (insertError) {
      console.error("[risks]", insertError);
      throw insertError;
    }
  } catch (error) {
    console.error("[risks]", error);
    throw error;
  }
}
