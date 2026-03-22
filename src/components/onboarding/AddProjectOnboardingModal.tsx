"use client";

import { useEffect, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { OnboardingStepActions } from "./OnboardingStepActions";

const ACTIVE_PROJECT_KEY = "activeProjectId";

type Props = {
  open: boolean;
  portfolioId: string | null;
  /** Re-open project setup without inserting again. */
  resumeProject: { id: string; name: string } | null;
  onCreated: (project: { id: string; name: string }) => void | Promise<void>;
  onBack: () => void;
};

export function AddProjectOnboardingModal({
  open,
  portfolioId,
  resumeProject,
  onCreated,
  onBack,
}: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !resumeProject) {
      setName("");
      setError(null);
    }
  }, [open, portfolioId, resumeProject]);

  if (!open || !portfolioId) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a project name.");
      return;
    }
    setLoading(true);
    const supabase = supabaseBrowserClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setError(userError?.message ?? "Not signed in.");
      setLoading(false);
      return;
    }
    const { data: inserted, error: insertError } = await supabase
      .from("projects")
      .insert({
        owner_user_id: user.id,
        name: trimmed,
        portfolio_id: portfolioId,
      })
      .select("id, name")
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }
    const row = inserted as { id: string; name: string } | null;
    if (!row?.id) {
      setError("Project created but could not continue.");
      setLoading(false);
      return;
    }
    try {
      window.localStorage.setItem(ACTIVE_PROJECT_KEY, row.id);
    } catch {
      // ignore
    }
    setLoading(false);
    await onCreated({ id: row.id, name: row.name });
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabaseBrowserClient().auth.signOut();
    window.location.href = "/login";
  }

  const busy = loading || signingOut;
  const inputClass =
    "w-full rounded-lg border border-neutral-300 bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:border-neutral-600 dark:focus:ring-neutral-500";
  const labelClass = "mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300";

  if (resumeProject) {
    return (
      <div
        className="fixed inset-0 z-[103] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-add-project-resume-title"
      >
        <div className="w-full max-w-md rounded-xl border border-neutral-200/90 bg-[var(--background)] p-6 shadow-xl dark:border-neutral-700/90">
          <h2
            id="onboarding-add-project-resume-title"
            className="text-lg font-semibold tracking-tight text-[var(--foreground)]"
          >
            Continue project setup
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            <span className="font-medium text-[var(--foreground)]">{resumeProject.name}</span> is
            created. Continue to finish setup, or go back to the previous step.
          </p>
          <OnboardingStepActions
            onBack={onBack}
            busy={busy}
            forwardSlot={
              <button
                type="button"
                disabled={busy}
                onClick={() => void onCreated({ id: resumeProject.id, name: resumeProject.name })}
                className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 sm:w-auto sm:min-w-[200px]"
              >
                Continue to project setup
              </button>
            }
          />
          <div className="mt-5 border-t border-neutral-200 pt-4 text-center dark:border-neutral-700">
            <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
              Don&apos;t want to continue right now?
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={handleSignOut}
              className="text-sm font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[103] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-add-project-title"
    >
      <div className="w-full max-w-md rounded-xl border border-neutral-200/90 bg-[var(--background)] p-6 shadow-xl dark:border-neutral-700/90">
        <h2
          id="onboarding-add-project-title"
          className="text-lg font-semibold tracking-tight text-[var(--foreground)]"
        >
          Add your first project
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Projects hold risks, simulations, and outputs for a single initiative.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="onb-project-name" className={labelClass}>
              Project name <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <input
              id="onb-project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="e.g. North corridor upgrade"
              autoComplete="off"
              disabled={busy}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <OnboardingStepActions
            onBack={onBack}
            busy={busy}
            forwardSlot={
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 sm:w-auto sm:min-w-[200px]"
              >
                {loading ? "Creating…" : "Continue"}
              </button>
            }
          />
          <div className="border-t border-neutral-200 pt-4 text-center dark:border-neutral-700">
            <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
              Don&apos;t want to continue right now?
            </p>
            <button
              type="button"
              disabled={busy}
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
