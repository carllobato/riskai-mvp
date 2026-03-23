import type { RiskRow } from "@/types/risk";
import type { Risk } from "@/domain/risk/risk.schema";
import { buildRating } from "@/domain/risk/risk.logic";
import { costToConsequenceScale, timeDaysToConsequenceScale } from "@/domain/risk/risk.logic";

/** Default project UUID used when no projectId is provided (legacy single-project flow). */
export const DEFAULT_PROJECT_ID = "a8995152-7065-4f79-ab8a-015b6ab0a3ec";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Supabase `public.risks` column list — keep in sync with DB (no `*`). */
export const RISK_DB_SELECT_COLUMNS =
  "id,project_id,risk_number,title,description,category,owner,applies_to,status,pre_probability,pre_cost_min,pre_cost_ml,pre_cost_max,pre_time_min,pre_time_ml,pre_time_max,mitigation_description,mitigation_cost,post_probability,post_cost_min,post_cost_ml,post_cost_max,post_time_min,post_time_ml,post_time_max,created_at,updated_at";

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
  const appliesRaw = row.applies_to?.trim();
  const appliesTo = appliesRaw && appliesRaw.length > 0 ? appliesRaw : undefined;
  const hasMitigation = Boolean(row.mitigation_description?.trim());
  return {
    id: row.id,
    riskNumber: row.risk_number ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    category: (row.category ?? "") as Risk["category"],
    status: row.status as Risk["status"],
    owner: row.owner ?? undefined,
    mitigation: row.mitigation_description ?? undefined,
    inherentRating: buildRating(row.pre_probability, preConsequence),
    residualRating: buildRating(row.post_probability, postConsequence),
    appliesTo,
    preMitigationCostMin: row.pre_cost_min ?? undefined,
    preMitigationCostML: row.pre_cost_ml,
    preMitigationCostMax: row.pre_cost_max ?? undefined,
    preMitigationTimeMin: row.pre_time_min ?? undefined,
    preMitigationTimeML: row.pre_time_ml,
    preMitigationTimeMax: row.pre_time_max ?? undefined,
    mitigationCost: hasMitigation ? row.mitigation_cost : undefined,
    postMitigationCostMin: hasMitigation ? (row.post_cost_min ?? undefined) : undefined,
    postMitigationCostML: hasMitigation ? (row.post_cost_ml ?? undefined) : undefined,
    postMitigationCostMax: hasMitigation ? (row.post_cost_max ?? undefined) : undefined,
    postMitigationTimeMin: hasMitigation ? (row.post_time_min ?? undefined) : undefined,
    postMitigationTimeML: hasMitigation ? (row.post_time_ml ?? undefined) : undefined,
    postMitigationTimeMax: hasMitigation ? (row.post_time_max ?? undefined) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    scoreHistory: [],
  };
}

export type RiskInsertRow = {
  id: string;
  project_id: string;
  risk_number: number | null;
  title: string;
  description: string | null;
  category: string;
  owner: string | null;
  applies_to: string | null;
  status: string;
  pre_probability: number;
  pre_cost_min: number | null;
  pre_cost_ml: number;
  pre_cost_max: number | null;
  pre_time_min: number | null;
  pre_time_ml: number;
  pre_time_max: number | null;
  mitigation_description: string | null;
  mitigation_cost: number;
  post_probability: number;
  post_cost_min: number | null;
  post_cost_ml: number;
  post_cost_max: number | null;
  post_time_min: number | null;
  post_time_ml: number;
  post_time_max: number | null;
  created_at: string;
  updated_at: string;
};

/**
 * Map domain Risk to DB insert row. Only columns that exist on `public.risks`.
 */
function riskToRow(risk: Risk, projectId: string): RiskInsertRow {
  const preCostMl = risk.preMitigationCostML;
  const preTimeMl = risk.preMitigationTimeML;
  const mitigationCost = risk.mitigationCost;
  const postCostMl = risk.postMitigationCostML;
  const postTimeMl = risk.postMitigationTimeML;
  const rowId = isUuid(risk.id) ? risk.id : crypto.randomUUID();
  return {
    id: rowId,
    project_id: projectId,
    risk_number: risk.riskNumber ?? null,
    title: risk.title,
    description: risk.description ?? null,
    category: risk.category,
    owner: risk.owner ?? null,
    applies_to: risk.appliesTo ?? null,
    status: risk.status,
    pre_probability: Number(risk.inherentRating.probability),
    pre_cost_min: risk.preMitigationCostMin ?? null,
    pre_cost_ml: Number(preCostMl ?? 0),
    pre_cost_max: risk.preMitigationCostMax ?? null,
    pre_time_min: risk.preMitigationTimeMin ?? null,
    pre_time_ml: Number(preTimeMl ?? 0),
    pre_time_max: risk.preMitigationTimeMax ?? null,
    mitigation_description: risk.mitigation ?? null,
    mitigation_cost: Number(mitigationCost ?? 0),
    post_probability: Number(risk.residualRating.probability),
    post_cost_min: risk.postMitigationCostMin ?? null,
    post_cost_ml: Number(postCostMl ?? 0),
    post_cost_max: risk.postMitigationCostMax ?? null,
    post_time_min: risk.postMitigationTimeMin ?? null,
    post_time_ml: Number(postTimeMl ?? 0),
    post_time_max: risk.postMitigationTimeMax ?? null,
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
  const res = await fetch(`/api/projects/${encodeURIComponent(pid)}/risks`, {
    method: "GET",
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { risks?: RiskRow[]; error?: string };
  if (!res.ok) {
    const message = json.error?.trim() || `Failed to load risks (${res.status})`;
    console.error("[risks] listRisks", message);
    throw new Error(message);
  }
  const rows = (json.risks ?? []) as RiskRow[];
  if (typeof console !== "undefined" && console.log) {
    console.log("[risks] listRisks select fields", RISK_DB_SELECT_COLUMNS);
    if (rows[0]) console.log("[risks] listRisks sample row keys", Object.keys(rows[0]).sort().join(","));
  }
  return rows.map(rowToRisk);
}

/**
 * Sync risks for the active project: upsert the given list; any DB rows for the project not in
 * the list are soft-deleted (archived) by the server route, never hard-deleted.
 * Returns the saved risks (with DB-assigned ids for rows that had non-UUID ids) so the
 * client can merge local-only fields by position and avoid losing data for newly created risks.
 * @param projectId - Optional project UUID; when omitted uses default (legacy single-project).
 */
export async function replaceRisks(risks: Risk[], projectId?: string): Promise<Risk[]> {
  const pid = projectId ?? DEFAULT_PROJECT_ID;
  const rows = risks.map((r) => riskToRow(r, pid));
  if (typeof console !== "undefined" && console.log && rows.length > 0) {
    console.log("[risks] replaceRisks upsert payload (per row keys)", Object.keys(rows[0] ?? {}).sort().join(","));
    console.log("[risks] replaceRisks upsert payload sample", JSON.stringify(rows[0] ?? null));
  }

  const res = await fetch(`/api/projects/${encodeURIComponent(pid)}/risks`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ risks: rows }),
  });
  const json = (await res.json().catch(() => ({}))) as { risks?: RiskRow[]; error?: string };
  if (!res.ok) {
    const message = json.error?.trim() || `Failed to save risks (${res.status})`;
    console.error("[risks] replaceRisks", message);
    throw new Error(message);
  }
  const savedRows = (json.risks ?? []) as RiskRow[];
  return savedRows.map(rowToRisk);
}
