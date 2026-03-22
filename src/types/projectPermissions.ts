/**
 * Effective project capabilities for the current user (table owner, project_members role, or portfolio access).
 * Aligns with RLS: viewers cannot mutate risks/snapshots; portfolio-only users cannot PATCH the project row.
 */
export type ProjectAccessMode = "owner" | "editor" | "viewer" | "portfolio";

export type ProjectPermissions = {
  /** PATCH project (name, etc.); project settings form */
  canEditProjectMetadata: boolean;
  /** Risks, simulation snapshots, AI merge review, etc. */
  canEditContent: boolean;
  /** project_members CRUD */
  canManageMembers: boolean;
  accessMode: ProjectAccessMode;
};
