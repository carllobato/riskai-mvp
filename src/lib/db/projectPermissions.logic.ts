/**
 * Access summary (aligned with RLS, 20250328_project_members):
 * - Table owner → full project + content + members.
 * - project_members.owner → same as table owner for app checks.
 * - project_members.editor → edit project row + risks/snapshots; no member admin.
 * - project_members.viewer → read-only project + risks.
 * - No member row but portfolio access → edit risks/snapshots only (not project row).
 */
import type { ProjectMemberRole } from "@/types/projectMembers";
import type { ProjectPermissions } from "@/types/projectPermissions";

type ResolveArgs = {
  tableOwnerUserId: string;
  currentUserId: string;
  /** Null when the user has no project_members row (e.g. portfolio-only access). */
  memberRole: ProjectMemberRole | null;
};

/**
 * Pure helper: same rules as RLS-backed behaviour (see supabase/migrations/20250328_project_members.sql).
 */
export function resolveProjectPermissions({
  tableOwnerUserId,
  currentUserId,
  memberRole,
}: ResolveArgs): ProjectPermissions {
  const isTableOwner = tableOwnerUserId === currentUserId;

  if (isTableOwner) {
    return {
      canEditProjectMetadata: true,
      canEditContent: true,
      canManageMembers: true,
      accessMode: "owner",
    };
  }

  if (memberRole === "owner") {
    return {
      canEditProjectMetadata: true,
      canEditContent: true,
      canManageMembers: true,
      accessMode: "owner",
    };
  }

  if (memberRole === "editor") {
    return {
      canEditProjectMetadata: true,
      canEditContent: true,
      canManageMembers: false,
      accessMode: "editor",
    };
  }

  if (memberRole === "viewer") {
    return {
      canEditProjectMetadata: false,
      canEditContent: false,
      canManageMembers: false,
      accessMode: "viewer",
    };
  }

  // Portfolio (or legacy) path: can mutate risks/snapshots per RLS, not the projects row.
  return {
    canEditProjectMetadata: false,
    canEditContent: true,
    canManageMembers: false,
    accessMode: "portfolio",
  };
}
