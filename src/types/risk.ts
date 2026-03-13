/**
 * DB row shape for the risks table (Supabase).
 * Extended columns (risk_number, applies_to, pre_*_min/max, post_*_min/max, etc.) are optional for backward compatibility.
 */
export type RiskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  category: string;
  owner: string | null;
  status: string;
  pre_probability: number;
  pre_cost_ml: number;
  pre_time_ml: number;
  mitigation_description: string | null;
  mitigation_cost: number;
  post_probability: number;
  post_cost_ml: number;
  post_time_ml: number;
  created_at: string;
  updated_at: string;
  risk_number?: number | null;
  applies_to?: string | null;
  pre_probability_pct?: number | null;
  pre_cost_min?: number | null;
  pre_cost_max?: number | null;
  pre_time_min?: number | null;
  pre_time_max?: number | null;
  post_probability_pct?: number | null;
  post_cost_min?: number | null;
  post_cost_max?: number | null;
  post_time_min?: number | null;
  post_time_max?: number | null;
  base_cost_impact?: number | null;
  cost_impact?: number | null;
  schedule_impact_days?: number | null;
  probability?: number | null;
};

/**
 * UI-editable fields for a risk (id optional for new rows; all fields needed for form/insert).
 * tempId used for stable React keys when id not yet set.
 */
export type RiskInput = {
  id?: string;
  tempId?: string;
  title: string;
  description: string | null;
  category: string;
  owner: string | null;
  status: string;
  pre_probability: number;
  pre_cost_ml: number;
  pre_time_ml: number;
  mitigation_description: string | null;
  mitigation_cost: number;
  post_probability: number;
  post_cost_ml: number;
  post_time_ml: number;
};
