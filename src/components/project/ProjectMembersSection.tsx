"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectMemberRole, ProjectMemberRow, ProfileDisplayRow } from "@/types/projectMembers";

type Viewer = {
  currentUserId: string;
  canManageMembers: boolean;
  memberRole: ProjectMemberRole | null;
};

type MembersResponse = {
  members: ProjectMemberRow[];
  profiles: Record<string, ProfileDisplayRow>;
  viewer: Viewer;
  roleSemantics?: Record<ProjectMemberRole, string>;
};

function displayName(profile: ProfileDisplayRow | undefined, userId: string): string {
  if (!profile) return userId;
  const parts = [profile.first_name, profile.surname].filter(Boolean);
  if (parts.length === 0) return userId;
  return parts.join(" ");
}

function displayEmail(profile: ProfileDisplayRow | undefined): string {
  return profile?.email?.trim() || "—";
}

const ROLE_OPTIONS: { value: ProjectMemberRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

export function ProjectMembersSection({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<ProjectMemberRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileDisplayRow>>({});
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [roleSemantics, setRoleSemantics] = useState<Record<ProjectMemberRole, string> | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<ProjectMemberRole>("editor");
  const [addError, setAddError] = useState<string | null>(null);
  const [rowActionError, setRowActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const cardClass =
    "rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4 sm:p-5";
  const labelClass = "block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1";
  const inputClass =
    "w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 h-10";

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, { credentials: "include" });
      const data = (await res.json().catch(() => null)) as MembersResponse & { error?: string; message?: string };

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
      setRoleSemantics((data.roleSemantics as Record<ProjectMemberRole, string>) ?? null);

      console.log("[project-members] members fetched (client)", {
        projectId,
        count: (data.members ?? []).length,
      });
    } catch {
      setListError("Could not load members.");
      setMembers([]);
      setProfiles({});
      setViewer(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canManage = viewer?.canManageMembers ?? false;

  const semanticsLine = useMemo(() => {
    if (!roleSemantics) return null;
    return (
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
        {ROLE_OPTIONS.map(({ value }) => (
          <span key={value} className="mr-3">
            <span className="font-medium text-neutral-600 dark:text-neutral-300 capitalize">{value}</span>
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
      const res = await fetch(`/api/projects/${projectId}/members`, {
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

      console.log("[project-members] member added (client)", { projectId, email });
      setAddEmail("");
      await load();
    } finally {
      setPendingId(null);
    }
  };

  const onRoleChange = async (member: ProjectMemberRow, role: ProjectMemberRole) => {
    setRowActionError(null);
    setAddError(null);
    setPendingId(member.id);
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${member.id}`, {
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
        setRowActionError(data.message ?? "Cannot remove the last project owner.");
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

      console.log("[project-members] role changed (client)", {
        projectId,
        memberId: member.id,
        role,
      });
      await load();
    } finally {
      setPendingId(null);
    }
  };

  const onRemove = async (member: ProjectMemberRow) => {
    setRowActionError(null);
    setAddError(null);
    setPendingId(member.id);
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${member.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json().catch(() => null)) as { error?: string; message?: string };

      if (res.status === 400 && data?.error === "LAST_OWNER") {
        setRowActionError(data.message ?? "Cannot remove the last project owner.");
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

      console.log("[project-members] member removed (client)", {
        projectId,
        memberId: member.id,
      });
      await load();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className={cardClass + " mb-4"}>
      <h2 className="text-base font-semibold text-[var(--foreground)] mb-3 border-b border-neutral-200 dark:border-neutral-700 pb-2">
        Project members
      </h2>

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
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Email</th>
                <th className="py-2 pr-3 font-medium">Role</th>
                {canManage && <th className="py-2 pr-0 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const prof = profiles[m.user_id];
                const isSelf = viewer?.currentUserId === m.user_id;
                const busy = pendingId === m.id;
                return (
                  <tr key={m.id} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-2 pr-3 text-[var(--foreground)]">
                      {displayName(prof, m.user_id)}
                    </td>
                    <td className="py-2 pr-3 text-neutral-600 dark:text-neutral-400">
                      {displayEmail(prof)}
                    </td>
                    <td className="py-2 pr-3">
                      {canManage && !isSelf ? (
                        <select
                          className={inputClass + " h-9 py-1"}
                          value={m.role}
                          disabled={busy}
                          aria-label={`Role for ${displayName(prof, m.user_id)}`}
                          onChange={(e) => {
                            const next = e.target.value as ProjectMemberRole;
                            if (next !== m.role) void onRoleChange(m, next);
                          }}
                        >
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
                    {canManage && (
                      <td className="py-2 pl-2 text-right">
                        {!isSelf ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void onRemove(m)}
                            className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
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

      {canManage && (
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
              <label htmlFor="member-email" className={labelClass}>
                Email
              </label>
              <input
                id="member-email"
                type="email"
                autoComplete="off"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                className={inputClass}
                placeholder="name@company.com"
              />
            </div>
            <div className="w-full sm:w-40">
              <label htmlFor="member-role" className={labelClass}>
                Role
              </label>
              <select
                id="member-role"
                className={inputClass}
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as ProjectMemberRole)}
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
              className="h-10 px-4 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {!canManage && viewer && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-3">
          Only project owners can add or change members. You can view the list above.
        </p>
      )}
    </section>
  );
}
