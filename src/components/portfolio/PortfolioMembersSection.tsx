"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { canonicalUserId, coerceProfileFromUnknown } from "@/lib/profileDisplayCoerce";
import type { ProfileDisplayRow } from "@/types/projectMembers";
import type {
  PortfolioMemberRole,
  PortfolioMemberWithProfileRow,
} from "@/types/portfolioMembers";
import { MemberSectionPermissionHints } from "@/components/settings/MemberSectionPermissionHints";
import {
  settingsCardClass,
  settingsInputClass,
  settingsLabelClass,
  settingsMemberAddButtonClass,
  settingsSectionTitleClass,
} from "@/components/settings/settingsFieldClasses";

type Viewer = {
  currentUserId: string;
  canManageMembers: boolean;
  memberRole: PortfolioMemberRole | null;
  canEditPortfolioDetails: boolean;
  canInviteMembers: boolean;
  canChangeMemberRoles: boolean;
  canRemoveMembers: boolean;
};

type MembersResponse = {
  members: PortfolioMemberWithProfileRow[];
  profiles: Record<string, ProfileDisplayRow>;
  viewer: Viewer;
  roleSemantics?: Record<PortfolioMemberRole, string>;
};

function resolveProfile(
  m: PortfolioMemberWithProfileRow,
  profilesMap: Record<string, ProfileDisplayRow>
): ProfileDisplayRow | undefined {
  const fromNested =
    coerceProfileFromUnknown(m.profiles) ?? coerceProfileFromUnknown(m.profile);
  if (fromNested) return fromNested;
  return profilesMap[canonicalUserId(m.user_id)] ?? profilesMap[m.user_id];
}

function normalizeResolvedProfile(
  m: PortfolioMemberWithProfileRow,
  profilesMap: Record<string, ProfileDisplayRow>
): ProfileDisplayRow | undefined {
  const fromResolved = coerceProfileFromUnknown(m.resolvedProfile);
  if (fromResolved) return fromResolved;
  return resolveProfile(m, profilesMap);
}

/** Primary label: trimmed first+surname, else server `member.email`, else profile email, else company, else placeholder. */
function computeDisplayName(
  profile: ProfileDisplayRow | undefined,
  topLevelEmail: string | null | undefined,
  _userId: string
): string {
  const fullName = [profile?.first_name, profile?.surname].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  const te = topLevelEmail?.trim();
  if (te) return te;
  const pe = profile?.email?.trim();
  if (pe) return pe;
  const co = profile?.company?.trim();
  if (co) return co;
  return "Invited user";
}

/** Prefer API-merged `member.email` (includes auth.users fallback) over nested profile only. */
function computeDisplayEmail(
  profile: ProfileDisplayRow | undefined,
  topLevelEmail: string | null | undefined
): string {
  const te = topLevelEmail?.trim();
  if (te) return te;
  const pe = profile?.email?.trim();
  if (pe) return pe;
  return "—";
}

const ROLE_OPTIONS: { value: PortfolioMemberRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

function isStandardPortfolioRole(role: string): role is PortfolioMemberRole {
  return (ROLE_OPTIONS as { value: string }[]).some((o) => o.value === role);
}

export function PortfolioMembersSection({ portfolioId }: { portfolioId: string }) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<PortfolioMemberWithProfileRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileDisplayRow>>({});
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [roleSemantics, setRoleSemantics] = useState<Record<PortfolioMemberRole, string> | null>(
    null
  );
  const [listError, setListError] = useState<string | null>(null);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<PortfolioMemberRole>("editor");
  const [addError, setAddError] = useState<string | null>(null);
  const [rowActionError, setRowActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/members`, { credentials: "include" });
      const data = (await res.json().catch(() => null)) as MembersResponse & {
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        setListError(data?.message ?? data?.error ?? "Could not load members.");
        setMembers([]);
        setProfiles({});
        setViewer(null);
        return;
      }

      setMembers(data.members ?? []);
      setProfiles(data.profiles ?? {});
      setViewer(data.viewer ?? null);
      setRoleSemantics((data.roleSemantics as Record<PortfolioMemberRole, string>) ?? null);
    } catch {
      setListError("Could not load members.");
      setMembers([]);
      setProfiles({});
      setViewer(null);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canInvite = viewer?.canInviteMembers ?? false;
  const canChangeRole = viewer?.canChangeMemberRoles ?? false;
  const canRemove = viewer?.canRemoveMembers ?? false;
  const showRowActions = canChangeRole || canRemove;

  const semanticsLine = useMemo(() => {
    if (!roleSemantics) return null;
    return (
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
        {ROLE_OPTIONS.map(({ value }) => (
          <span key={value} className="mr-3">
            <span className="font-medium text-neutral-600 dark:text-neutral-300 capitalize">
              {value}
            </span>
            {": "}
            {roleSemantics[value]}
          </span>
        ))}
      </p>
    );
  }, [roleSemantics]);

  const onAdd = async () => {
    setAddError(null);
    setRowActionError(null);
    const email = addEmail.trim();
    if (!email) {
      setAddError("Enter an email address.");
      return;
    }
    setPendingId("__add__");
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/members`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: addRole }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; message?: string };

      if (res.status === 404 && data?.error === "USER_NOT_FOUND") {
        setAddError(data.message ?? "User not found. They need to sign up first.");
        return;
      }
      if (res.status === 409 && data?.error === "DUPLICATE_MEMBER") {
        setAddError(data.message ?? "This user is already a member.");
        return;
      }
      if (res.status === 403 && data?.error === "PERMISSION_DENIED") {
        setAddError(data.message ?? "Permission denied.");
        return;
      }
      if (!res.ok) {
        setAddError(data?.message ?? data?.error ?? "Could not add member.");
        return;
      }

      setAddEmail("");
      await load();
    } finally {
      setPendingId(null);
    }
  };

  const onRoleChange = async (member: PortfolioMemberWithProfileRow, role: PortfolioMemberRole) => {
    setRowActionError(null);
    setAddError(null);
    setPendingId(member.id);
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/members/${member.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; message?: string };

      if (res.status === 400 && data?.error === "CANNOT_CHANGE_SELF") {
        setRowActionError(data.message ?? "You cannot change your own role here.");
        return;
      }
      if (res.status === 400 && data?.error === "LAST_OWNER") {
        setRowActionError(data.message ?? "Cannot remove the last portfolio owner role.");
        return;
      }
      if (res.status === 403 && data?.error === "PERMISSION_DENIED") {
        setRowActionError(data.message ?? "Permission denied.");
        return;
      }
      if (!res.ok) {
        setRowActionError(data?.message ?? data?.error ?? "Could not update role.");
        return;
      }

      await load();
    } finally {
      setPendingId(null);
    }
  };

  const onRemove = async (member: PortfolioMemberWithProfileRow) => {
    setRowActionError(null);
    setAddError(null);
    setPendingId(member.id);
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/members/${member.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json().catch(() => null)) as { error?: string; message?: string };

      if (res.status === 400 && data?.error === "LAST_OWNER") {
        setRowActionError(data.message ?? "Cannot remove the last portfolio owner role.");
        return;
      }
      if (res.status === 403 && data?.error === "PERMISSION_DENIED") {
        setRowActionError(data.message ?? "Permission denied.");
        return;
      }
      if (!res.ok) {
        setRowActionError(data?.message ?? data?.error ?? "Could not remove member.");
        return;
      }

      await load();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className={settingsCardClass + " mb-4"}>
      <h2 className={settingsSectionTitleClass}>Portfolio members</h2>

      {semanticsLine}

      {listError && (
        <div
          className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-800 dark:text-red-200"
          role="alert"
        >
          {listError}
        </div>
      )}

      {rowActionError && (
        <div
          className="mb-3 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
          role="alert"
        >
          {rowActionError}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading members…</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="min-w-full text-sm text-left">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400">
                <th className="py-2 pr-3 font-medium">First name</th>
                <th className="py-2 pr-3 font-medium">Surname</th>
                <th className="py-2 pr-3 font-medium">Email</th>
                <th className="py-2 pr-3 font-medium">Role</th>
                {showRowActions && <th className="py-2 pr-0 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const normalizedProfile = normalizeResolvedProfile(m, profiles);
                const displayEmail = computeDisplayEmail(normalizedProfile, m.email);
                const isSelf = viewer?.currentUserId === m.user_id;
                const busy = pendingId === m.id;
                const rowLabel = computeDisplayName(normalizedProfile, m.email, m.user_id);
                const fullName = [normalizedProfile?.first_name, normalizedProfile?.surname]
                  .filter(Boolean)
                  .join(" ")
                  .trim();
                const hasNameParts = fullName.length > 0;
                const identityFallback = rowLabel;
                const fn = hasNameParts
                  ? normalizedProfile?.first_name?.trim() || "—"
                  : identityFallback;
                const sn = hasNameParts ? normalizedProfile?.surname?.trim() || "—" : "—";
                return (
                  <tr key={m.id} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-2 pr-3 text-[var(--foreground)]">{fn}</td>
                    <td className="py-2 pr-3 text-[var(--foreground)]">{sn}</td>
                    <td className="py-2 pr-3 text-neutral-600 dark:text-neutral-400">
                      {displayEmail}
                    </td>
                    <td className="py-2 pr-3">
                      {canChangeRole && !isSelf ? (
                        <select
                          className={settingsInputClass + " h-9 py-1"}
                          value={m.role}
                          disabled={busy}
                          aria-label={`Role for ${rowLabel}`}
                          onChange={(e) => {
                            const next = e.target.value as PortfolioMemberRole | string;
                            if (!isStandardPortfolioRole(next)) return;
                            if (next !== m.role) void onRoleChange(m, next);
                          }}
                        >
                          {!isStandardPortfolioRole(m.role) && (
                            <option value={m.role}>
                              {m.role} (current)
                            </option>
                          )}
                          {ROLE_OPTIONS.map(({ value, label }) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="capitalize text-[var(--foreground)]">{m.role}</span>
                      )}
                    </td>
                    {showRowActions && (
                      <td className="py-2 pl-2 text-right">
                        {canRemove && !isSelf ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void onRemove(m)}
                            className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Remove
                          </button>
                        ) : (
                          <span className="text-neutral-400 text-xs">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {members.length === 0 && !listError && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">No members yet.</p>
          )}
        </div>
      )}

      {canInvite && (
        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 space-y-3">
          <p className="text-sm font-medium text-[var(--foreground)]">Add member</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Enter the email of an existing RiskAI user (they must have signed up already).
          </p>
          {addError && (
            <div
              className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-800 dark:text-red-200"
              role="alert"
            >
              {addError}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1 min-w-0">
              <label htmlFor="portfolio-member-email" className={settingsLabelClass}>
                Email
              </label>
              <input
                id="portfolio-member-email"
                type="email"
                autoComplete="off"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                className={settingsInputClass}
                placeholder="name@company.com"
              />
            </div>
            <div className="w-full sm:w-40">
              <label htmlFor="portfolio-member-role" className={settingsLabelClass}>
                Role
              </label>
              <select
                id="portfolio-member-role"
                className={settingsInputClass}
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as PortfolioMemberRole)}
              >
                {ROLE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void onAdd()}
              disabled={pendingId === "__add__"}
              className={settingsMemberAddButtonClass}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {viewer && (
        <MemberSectionPermissionHints
          resource="portfolio"
          canInviteMembers={viewer.canInviteMembers}
          canChangeMemberRoles={viewer.canChangeMemberRoles}
        />
      )}
    </section>
  );
}
