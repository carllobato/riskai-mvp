export type ProjectMemberRole = "owner" | "editor" | "viewer";

export type ProjectMemberRow = {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectMemberRole;
  created_at: string;
  updated_at: string;
};

export type ProfileDisplayRow = {
  id: string;
  first_name: string | null;
  surname: string | null;
  email: string | null;
};

export type ProjectMembersViewerContext = {
  currentUserId: string;
  canManageMembers: boolean;
  memberRole: ProjectMemberRole | null;
};
