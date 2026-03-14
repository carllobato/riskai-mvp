import { getProjectIfAccessible, type ProjectRow } from "@/lib/db/projectAccess";
import { supabaseServerClient } from "@/lib/supabase/server";

export type AssertProjectAccessOk = { project: ProjectRow };
export type AssertProjectAccessDenied =
  | { error: "unauthorized" }
  | { error: "forbidden" };
export type AssertProjectAccessResult =
  | AssertProjectAccessOk
  | AssertProjectAccessDenied;

/**
 * Server-only. Verifies the current user can access the project (owner or portfolio member).
 * Use in page loaders (redirect if denied) and API routes (return 401/404).
 */
export async function assertProjectAccess(
  projectId: string
): Promise<AssertProjectAccessResult> {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "unauthorized" };
  }

  const project = await getProjectIfAccessible(projectId);
  if (!project) {
    return { error: "forbidden" };
  }

  return { project };
}
