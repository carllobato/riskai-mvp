type ResourceKind = "portfolio" | "project";

/**
 * Footnotes under the members table for invite vs role-management permissions.
 */
export function MemberSectionPermissionHints({
  resource,
  canInviteMembers,
  canChangeMemberRoles,
}: {
  resource: ResourceKind;
  canInviteMembers: boolean;
  canChangeMemberRoles: boolean;
}) {
  const ownerPhrase = resource === "portfolio" ? "portfolio owner" : "project owner";
  const hintClass = "text-xs text-neutral-500 dark:text-neutral-400 mt-3";

  return (
    <>
      {!canInviteMembers && (
        <p className={hintClass}>
          You can view members. Only owners and editors can invite; only owners can change roles or remove
          members.
        </p>
      )}
      {canInviteMembers && !canChangeMemberRoles && (
        <p className={hintClass}>
          You can invite members. Only a {ownerPhrase} can change roles or remove members.
        </p>
      )}
    </>
  );
}
