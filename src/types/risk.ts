/**
 * DB row shape for the risks table (Supabase).
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
