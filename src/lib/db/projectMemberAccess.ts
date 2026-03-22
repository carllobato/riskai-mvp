import type {
  ProjectMemberRole,
  ProjectMembersViewerContext,
} from "@/types/projectMembers";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { ProjectMemberRole, ProjectMembersViewerContext };

export type ProjectMemberCapabilityFlags = {
  canInviteMembers: boolean;
  canChangeMemberRoles: boolean;
  canRemoveMembers: boolean;
};

/** Aligns with project RLS: owners (table or role) full member admin; editors may invite only. */
export function resolveProjectMemberCapabilityFlags(
  isTableOwner: boolean,
  rowRole: ProjectMemberRole | undefined
): ProjectMemberCapabilityFlags {
  const ownerCaps = isTableOwner || rowRole === "owner";
  const editorOnly = !ownerCaps && rowRole === "editor";
  return {
    canInviteMembers: ownerCaps || editorOnly,
    canChangeMemberRoles: ownerCaps,
    canRemoveMembers: ownerCaps,
  };
}

/**
 * Server-side: member list UI + API capability flags (invite vs role/remove), aligned with RLS.
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

  const memberRole: ProjectMemberRole | null = isTableOwner
    ? "owner"
    : rowRole ?? null;

  const caps = resolveProjectMemberCapabilityFlags(isTableOwner, rowRole);
  const canManageMembers = caps.canChangeMemberRoles || caps.canRemoveMembers;

  return {
    currentUserId: userId,
    canManageMembers,
    memberRole,
    ...caps,
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
