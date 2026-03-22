import type { PortfolioMemberCapabilityFlags } from "@/lib/db/portfolioMemberAccess";

/** Shown when project metadata fields are read-only (viewer / no edit permission). */
export const PROJECT_SETTINGS_METADATA_VIEW_ONLY_NOTICE =
  "View-only access: you can review project settings but not change them.";

/**
 * Portfolio settings banner from server-resolved capabilities (matches portfolio role model).
 */
export function getPortfolioSettingsPermissionNotice(
  caps: PortfolioMemberCapabilityFlags
): string | null {
  if (caps.canEditPortfolioDetails) {
    return null;
  }
  if (!caps.canInviteMembers) {
    return "View-only access: you can review portfolio settings and members but cannot make changes.";
  }
  return "You can view settings and invite members. Only the portfolio owner can edit portfolio details, change roles, or remove members.";
}
