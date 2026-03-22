"use client";

/**
 * Portfolio Settings: editable name and description, read-only members and meta.
 * Mirrors the editable form pattern used on the project settings page.
 */

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PortfolioMemberRow } from "@/lib/portfolios-server";

export type PortfolioSettingsInitial = {
  name: string;
  description: string | null;
  owner_user_id: string;
  created_at: string | null;
};

const SAVED_CONFIRM_AUTO_HIDE_MS = 3000;

export type PortfolioSettingsContentProps = {
  portfolioId: string;
  initial: PortfolioSettingsInitial;
  members: PortfolioMemberRow[];
};

function formatDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";
}

export default function PortfolioSettingsContent({
  portfolioId,
  initial,
  members: memberList,
}: PortfolioSettingsContentProps) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [saved, setSaved] = useState(false);
  const [validation, setValidation] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const nameError = !name.trim() ? "Name is required" : "";
  const isFormValid = name.trim().length > 0;

  const onSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidation({ name: "Name is required" });
      return;
    }
    setValidation({});
    setSaving(true);
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || null,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setValidation({ submit: (data as { error?: string }).error ?? "Failed to save" });
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), SAVED_CONFIRM_AUTO_HIDE_MS);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [portfolioId, name, description, router]);

  const cardClass =
    "rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4 sm:p-5";
  const labelClass =
    "block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1";
  const inputClass =
    "w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 min-h-10";
  const inputErrorClass =
    "w-full rounded-md border-2 border-red-500 dark:border-red-400 bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 dark:focus:ring-red-500 min-h-10";

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      {/* Editable Settings */}
      <section className={cardClass + " mb-6"}>
        <h2 className="text-lg font-medium text-[var(--foreground)] mb-3 border-b border-neutral-200 dark:border-neutral-700 pb-2">
          Settings
        </h2>
        <div className="space-y-3">
          <div>
            <label htmlFor="portfolio-name" className={labelClass}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="portfolio-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setValidation((prev) => ({ ...prev, name: "" }));
              }}
              className={validation.name ? inputErrorClass : inputClass}
              placeholder="e.g. Infrastructure Portfolio"
            />
            {validation.name && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {validation.name}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="portfolio-description" className={labelClass}>
              Description (optional)
            </label>
            <textarea
              id="portfolio-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              placeholder="Brief description of this portfolio"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={!isFormValid || saving}
            className="px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {validation.submit && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {validation.submit}
            </p>
          )}
        </div>
        {saved && (
          <div
            className="mt-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5 text-sm text-emerald-800 dark:text-emerald-200"
            role="status"
          >
            Saved ✓ Portfolio settings updated.
          </div>
        )}
      </section>

      {/* Read-only meta */}
      <section className="mb-10">
        <h2 className="text-lg font-medium text-[var(--foreground)] mb-3">
          Details
        </h2>
        <dl className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 p-4 space-y-2 text-sm">
          <div>
            <dt className="text-neutral-500 dark:text-neutral-400">Owner ID</dt>
            <dd className="font-mono text-xs text-[var(--foreground)] break-all">
              {initial.owner_user_id}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500 dark:text-neutral-400">Created</dt>
            <dd className="text-[var(--foreground)]">
              {formatDate(initial.created_at)}
            </dd>
          </div>
        </dl>
      </section>

      {/* Members section */}
      <section className="mb-10">
        <h2 className="text-lg font-medium text-[var(--foreground)] mb-3">
          Members
        </h2>
        {memberList.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 p-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
            No members listed (owner is implicit).
          </div>
        ) : (
          <ul className="space-y-2">
            {memberList.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-4 px-4 py-3 rounded-md border border-neutral-200 dark:border-neutral-700 bg-[var(--background)]"
              >
                <span className="font-mono text-xs text-[var(--foreground)] break-all">
                  {m.user_id}
                </span>
                <span
                  className="shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-neutral-200 dark:bg-neutral-600 text-[var(--foreground)]"
                  title="Role"
                >
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Admin actions (placeholders) */}
      <section className="mb-10">
        <h2 className="text-lg font-medium text-[var(--foreground)] mb-3">
          Admin actions
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
          Future actions will appear here.
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
            <span className="font-medium text-[var(--foreground)]">
              Add member
            </span>
            <span className="text-xs">(placeholder)</span>
          </li>
          <li className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
            <span className="font-medium text-[var(--foreground)]">
              Change role
            </span>
            <span className="text-xs">(placeholder)</span>
          </li>
          <li className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
            <span className="font-medium text-[var(--foreground)]">
              Remove member
            </span>
            <span className="text-xs">(placeholder)</span>
          </li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/portfolios/${portfolioId}/projects`}
          className="inline-flex px-4 py-2 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
        >
          View projects
        </Link>
        <Link
          href="/portfolios"
          className="inline-flex px-4 py-2 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
        >
          ← Back to portfolios
        </Link>
      </div>
    </main>
  );
}
