import { supabaseServerClient } from "@/lib/supabase/server";

export type ProjectRow = { id: string; name: string; created_at: string | null };

/**
 * Returns the project if the current user can access it (owner or portfolio member).
 * RLS on projects restricts SELECT to owner_id = auth.uid() OR portfolio access.
 * Used by project layout to validate access before rendering.
 */
export async function getProjectIfAccessible(
  projectId: string
): Promise<ProjectRow | null> {
  const supabase = await supabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .eq("id", projectId)
    .single();

  if (error || !data) return null;
  return data as ProjectRow;
}

/**
 * Returns the project if it exists and belongs to the given user (owner only).
 * Prefer getProjectIfAccessible(projectId) when you want portfolio-based access.
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
