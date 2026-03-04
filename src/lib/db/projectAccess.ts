import { supabaseServerClient } from "@/lib/supabase/server";

export type ProjectRow = { id: string; name: string; created_at: string | null };

/**
 * Returns the project if it exists and belongs to the given user; otherwise null.
 * Used by project layout to validate ownership before rendering.
 */
export async function getProjectIfOwned(
  projectId: string,
  userId: string
): Promise<ProjectRow | null> {
  const supabase = await supabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .single();

  if (error || !data) return null;
  return data as ProjectRow;
}
