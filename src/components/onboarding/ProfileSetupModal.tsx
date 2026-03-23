"use client";

import { useEffect, useState } from "react";
import { ACCOUNT_PROFILE_UPDATED_EVENT } from "@/lib/onboarding/types";
import { saveUserProfileThroughApi } from "@/lib/profiles/profileDb";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { OnboardingStepActions } from "./OnboardingStepActions";

type Props = {
  open: boolean;
  initialFirstName?: string;
  initialLastName?: string;
  initialCompany?: string;
  initialRole?: string;
  onComplete: () => void | Promise<void>;
};

export function ProfileSetupModal({
  open,
  initialFirstName = "",
  initialLastName = "",
  initialCompany = "",
  initialRole = "",
  onComplete,
}: Props) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [company, setCompany] = useState(initialCompany);
  const [role, setRole] = useState(initialRole);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFirstName(initialFirstName ?? "");
    setLastName(initialLastName ?? "");
    setCompany(initialCompany ?? "");
    setRole(initialRole ?? "");
    setError(null);
  }, [open, initialFirstName, initialLastName, initialCompany, initialRole]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fn = firstName.trim();
    const ln = lastName.trim();
    const co = company.trim();
    if (!fn) {
      setError("First name is required.");
      return;
    }
    if (!ln) {
      setError("Surname is required.");
      return;
    }
    if (!co) {
      setError("Company is required.");
      return;
    }
    setSaving(true);
    const { error: errMsg } = await saveUserProfileThroughApi({
      first_name: fn,
      last_name: ln,
      company: co,
      role: role.trim() || null,
    });
    if (errMsg) {
      setSaving(false);
      setError(errMsg);
      return;
    }
    window.dispatchEvent(new CustomEvent(ACCOUNT_PROFILE_UPDATED_EVENT));
    try {
      await Promise.resolve(onComplete());
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabaseBrowserClient().auth.signOut();
    window.location.href = "/";
  }

  const inputClass =
    "w-full rounded-lg border border-neutral-300 bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:border-neutral-600 dark:focus:ring-neutral-500";
  const labelClass = "mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-profile-title"
    >
      <div className="w-full max-w-md rounded-xl border border-neutral-200/90 bg-[var(--background)] p-6 shadow-xl dark:border-neutral-700/90">
        <h2
          id="onboarding-profile-title"
          className="text-lg font-semibold tracking-tight text-[var(--foreground)]"
        >
          Welcome — set up your profile
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          A few details so we can personalise your workspace.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="onb-first-name" className={labelClass}>
              First name <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <input
              id="onb-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
              autoComplete="given-name"
              required
              disabled={saving || signingOut}
            />
          </div>
          <div>
            <label htmlFor="onb-last-name" className={labelClass}>
              Surname <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <input
              id="onb-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
              autoComplete="family-name"
              required
              disabled={saving || signingOut}
            />
          </div>
          <div>
            <label htmlFor="onb-company" className={labelClass}>
              Company <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <input
              id="onb-company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className={inputClass}
              autoComplete="organization"
              required
              disabled={saving || signingOut}
            />
          </div>
          <div>
            <label htmlFor="onb-role" className={labelClass}>
              Role <span className="font-normal text-neutral-500">(optional)</span>
            </label>
            <input
              id="onb-role"
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={inputClass}
              placeholder="e.g. Risk manager"
              autoComplete="organization-title"
              disabled={saving || signingOut}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <OnboardingStepActions
            busy={saving || signingOut}
            forwardSlot={
              <button
                type="submit"
                disabled={saving || signingOut}
                className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
              >
                {saving ? "Saving…" : "Continue"}
              </button>
            }
          />
          <div className="mt-5 border-t border-neutral-200 pt-4 text-center dark:border-neutral-700">
            <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
              Don&apos;t want to continue right now?
            </p>
            <button
              type="button"
              disabled={saving || signingOut}
              onClick={handleSignOut}
              className="text-sm font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
