import { resolveProjectPermissions } from "@/lib/db/projectPermissions.logic";
import type {
  ProjectMemberRole,
  ProjectMembersViewerContext,
} from "@/types/projectMembers";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { ProjectMemberRole, ProjectMembersViewerContext };

/**
 * Server-side: management flag + display role for the project members UI (uses shared permission resolver).
 */
export async function getProjectMembersViewerContext(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<ProjectMembersViewerContext | null> {
  const { data: project, error: pErr } = await supabase
    .from("projects")
    .select("owner_user_id")
    .eq("id", projectId)
    .single();

  if (pErr || !project) return null;

  const ownerUserId = project.owner_user_id as string;

  const { data: memberRow } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  const rowRole = memberRow?.role as ProjectMemberRole | undefined;
  const isTableOwner = ownerUserId === userId;
  const permissions = resolveProjectPermissions({
    tableOwnerUserId: ownerUserId,
    currentUserId: userId,
    memberRole: rowRole ?? null,
  });

  const memberRole: ProjectMemberRole | null = isTableOwner
    ? "owner"
    : rowRole ?? null;

  return {
    currentUserId: userId,
    canManageMembers: permissions.canManageMembers,
    memberRole,
  };
}

export async function countProjectOwners(
  supabase: SupabaseClient,
  projectId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("project_members")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("role", "owner");

  if (error) return 0;
  return count ?? 0;
}
