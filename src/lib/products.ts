import type { SupabaseClient } from "@supabase/supabase-js";

let cachedRiskAIProductId: string | null = null;
let riskAIProductIdPromise: Promise<string> | null = null;

/**
 * Resolves the RiskAI catalog row in `public.products` (key = `riskai`).
 * Cached per Node process; concurrent callers share one in-flight query.
 */
export async function getRiskAIProductId(supabase: SupabaseClient): Promise<string> {
  if (cachedRiskAIProductId) {
    return cachedRiskAIProductId;
  }
  if (riskAIProductIdPromise) {
    return riskAIProductIdPromise;
  }

  riskAIProductIdPromise = (async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .eq("key", "riskai")
      .single();

    if (error || !data) {
      riskAIProductIdPromise = null;
      throw new Error("RiskAI product not found");
    }

    const id = data.id;
    cachedRiskAIProductId = id;
    return id;
  })();

  return riskAIProductIdPromise;
}
