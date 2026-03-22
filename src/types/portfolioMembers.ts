import type { ProfileDisplayRow } from "@/types/projectMembers";

export type PortfolioMemberRole = "owner" | "editor" | "viewer";

export type PortfolioMemberRow = {
  id: string;
  portfolio_id: string;
  user_id: string;
  /** Stored role; may include legacy values (e.g. admin, member). */
  role: string;
  created_at: string;
};

export type PortfolioMemberWithProfileRow = PortfolioMemberRow & {
  profiles?: ProfileDisplayRow | ProfileDisplayRow[] | null;
  profile?: ProfileDisplayRow | ProfileDisplayRow[] | null;
  email?: string | null;
  resolvedProfile?: ProfileDisplayRow | null;
};

export type PortfolioMembersViewerContext = {
  currentUserId: string;
  /** True when the user may change others' roles or remove members (portfolio owner). */
  canManageMembers: boolean;
  memberRole: PortfolioMemberRole | null;
  canEditPortfolioDetails: boolean;
  canInviteMembers: boolean;
  canChangeMemberRoles: boolean;
  canRemoveMembers: boolean;
};
