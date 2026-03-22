import {
  getProjectAccessForUser,
  type ProjectRow,
} from "@/lib/db/projectAccess";
import type { ProjectPermissions } from "@/types/projectPermissions";
import { supabaseServerClient } from "@/lib/supabase/server";

export type AssertProjectAccessOk = {
  project: ProjectRow;
  permissions: ProjectPermissions;
};
export type AssertProjectAccessDenied =
  | { error: "unauthorized" }
  | { error: "forbidden" };
export type AssertProjectAccessResult =
  | AssertProjectAccessOk
  | AssertProjectAccessDenied;

/**
 * Server-only. Verifies the current user can read the project and returns capability flags
 * (table owner, project_members role, or portfolio-only) aligned with RLS.
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

  const bundle = await getProjectAccessForUser(projectId, user.id);
  if (!bundle) {
    return { error: "forbidden" };
  }

  return { project: bundle.project, permissions: bundle.permissions };
}
