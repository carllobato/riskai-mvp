"use client";

/**
 * Portfolio Settings: editable name and description, members (API-driven), and read-only meta.
 * Mirrors the editable form pattern used on the project settings page.
 */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PortfolioMembersSection } from "@/components/portfolio/PortfolioMembersSection";
import { SettingsPermissionNotice } from "@/components/settings/SettingsPermissionNotice";
import {
  settingsCardClass,
  settingsFieldLockedClass,
  settingsInputClass,
  settingsInputErrorClassSingleLine,
  settingsLabelClass,
  settingsPrimaryButtonClass,
  settingsSectionTitleClass,
  settingsStandaloneSectionTitleClass,
  settingsTextareaClass,
} from "@/components/settings/settingsFieldClasses";
import type { PortfolioMemberCapabilityFlags } from "@/lib/db/portfolioMemberAccess";
import { getPortfolioSettingsPermissionNotice } from "@/lib/settings/settingsPermissionMessages";

export type PortfolioSettingsInitial = {
  name: string;
  description: string | null;
  owner_user_id: string;
  created_at: string | null;
};

const SAVED_CONFIRM_AUTO_HIDE_MS = 3000;

export type PortfolioSettingsContentProps = {
  portfolioId: string;
  memberCapabilities: PortfolioMemberCapabilityFlags;
  initial: PortfolioSettingsInitial;
};

function formatDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";
}

export default function PortfolioSettingsContent({
  portfolioId,
  memberCapabilities,
  initial,
}: PortfolioSettingsContentProps) {
  const router = useRouter();
  const { canEditPortfolioDetails } = memberCapabilities;
  const permissionNotice = useMemo(
    () => getPortfolioSettingsPermissionNotice(memberCapabilities),
    [memberCapabilities]
  );
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [saved, setSaved] = useState(false);
  const [validation, setValidation] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isFormValid = name.trim().length > 0;

  const onSave = useCallback(async () => {
    if (!canEditPortfolioDetails) return;
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
  }, [portfolioId, name, description, router, canEditPortfolioDetails]);

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      {permissionNotice && (
        <SettingsPermissionNotice>{permissionNotice}</SettingsPermissionNotice>
      )}

      {/* Editable Settings */}
      <section className={settingsCardClass + " mb-6"}>
        <h2 className={settingsSectionTitleClass}>Settings</h2>
        <div className="space-y-3">
          <div>
            <label htmlFor="portfolio-name" className={settingsLabelClass}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="portfolio-name"
              type="text"
              readOnly={!canEditPortfolioDetails}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setValidation((prev) => ({ ...prev, name: "" }));
              }}
              className={
                (validation.name ? settingsInputErrorClassSingleLine : settingsInputClass) +
                (!canEditPortfolioDetails ? ` ${settingsFieldLockedClass}` : "")
              }
              placeholder="e.g. Infrastructure Portfolio"
            />
            {validation.name && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {validation.name}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="portfolio-description" className={settingsLabelClass}>
              Description (optional)
            </label>
            <textarea
              id="portfolio-description"
              rows={3}
              readOnly={!canEditPortfolioDetails}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={
                settingsTextareaClass +
                (!canEditPortfolioDetails ? ` ${settingsFieldLockedClass}` : "")
              }
              placeholder="Brief description of this portfolio"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={!canEditPortfolioDetails || !isFormValid || saving}
            className={settingsPrimaryButtonClass}
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

      <PortfolioMembersSection portfolioId={portfolioId} />

      {/* Read-only meta */}
      <section className="mb-10">
        <h2 className={settingsStandaloneSectionTitleClass}>Details</h2>
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
