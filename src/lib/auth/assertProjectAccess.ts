import { supabaseServerClient } from "@/lib/supabase/server";
import { getProjectIfOwned, type ProjectRow } from "@/lib/db/projectAccess";

export type AssertProjectAccessOk = { project: ProjectRow };
export type AssertProjectAccessDenied =
  | { error: "unauthorized" }
  | { error: "forbidden" };
export type AssertProjectAccessResult =
  | AssertProjectAccessOk
  | AssertProjectAccessDenied;

/**
 * Server-only. Verifies the current user owns the project.
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

  const project = await getProjectIfOwned(projectId, user.id);
  if (!project) {
    return { error: "forbidden" };
  }

  return { project };
}
