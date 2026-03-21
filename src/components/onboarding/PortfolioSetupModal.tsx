"use client";

import { useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { OnboardingMetaKey } from "@/lib/onboarding/types";
import { OnboardingStepActions } from "./OnboardingStepActions";

type Props = {
  open: boolean;
  /** After “Back” from portfolio details — confirm before returning to the detail step. */
  postCreateBridge: { id: string; name: string } | null;
  onBackToProfile: () => void;
  onForwardFromPostCreateBridge: () => void;
  onCreated: (portfolio: { id: string; name: string }) => void | Promise<void>;
  /** Skip creates a default portfolio so projects can be added without the naming step. */
  onSkipped: (payload: { portfolioId: string }) => void | Promise<void>;
};

export function PortfolioSetupModal({
  open,
  postCreateBridge,
  onBackToProfile,
  onForwardFromPostCreateBridge,
  onCreated,
  onSkipped,
}: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a portfolio name.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        portfolio?: { id: string; name: string };
      };
      if (!res.ok || !json.portfolio?.id) {
        setError(json.error ?? "Could not create portfolio.");
        setLoading(false);
        return;
      }
      setLoading(false);
      await onCreated({ id: json.portfolio.id, name: json.portfolio.name });
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  async function handleSkip() {
    setError(null);
    setSkipping(true);
    try {
      const res = await fetch("/api/portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My portfolio" }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        portfolio?: { id: string };
      };
      if (!res.ok || !json.portfolio?.id) {
        setError(json.error ?? "Could not create a portfolio.");
        return;
      }
      const supabase = supabaseBrowserClient();
      const { error: err } = await supabase.auth.updateUser({
        data: { [OnboardingMetaKey.portfolioSkipped]: true },
      });
      if (err) {
        setError(err.message);
        return;
      }
      await onSkipped({ portfolioId: json.portfolio.id });
    } finally {
      setSkipping(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabaseBrowserClient().auth.signOut();
    window.location.href = "/login";
  }

  const busy = loading || skipping || signingOut;
  const inputClass =
    "w-full rounded-lg border border-neutral-300 bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:border-neutral-600 dark:focus:ring-neutral-500";
  const labelClass = "mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300";

  if (postCreateBridge) {
    return (
      <div
        className="fixed inset-0 z-[101] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-portfolio-bridge-title"
      >
        <div className="w-full max-w-md rounded-xl border border-neutral-200/90 bg-[var(--background)] p-6 shadow-xl dark:border-neutral-700/90">
          <h2
            id="onboarding-portfolio-bridge-title"
            className="text-lg font-semibold tracking-tight text-[var(--foreground)]"
          >
            Portfolio created
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            <span className="font-medium text-[var(--foreground)]">{postCreateBridge.name}</span> is
            ready. Continue to add a description, or go back to your profile.
          </p>
          <OnboardingStepActions
            onBack={onBackToProfile}
            busy={busy}
            forwardSlot={
              <button
                type="button"
                disabled={busy}
                onClick={() => void onForwardFromPostCreateBridge()}
                className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 sm:w-auto sm:min-w-[200px]"
              >
                Continue to portfolio details
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
      className="fixed inset-0 z-[101] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-portfolio-title"
    >
      <div className="w-full max-w-md rounded-xl border border-neutral-200/90 bg-[var(--background)] p-6 shadow-xl dark:border-neutral-700/90">
        <h2
          id="onboarding-portfolio-title"
          className="text-lg font-semibold tracking-tight text-[var(--foreground)]"
        >
          Name your portfolio
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Portfolios group your projects. Skip creates a default portfolio you can rename later.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="onboarding-portfolio-name" className={labelClass}>
              Portfolio name
            </label>
            <input
              id="onboarding-portfolio-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Capital projects 2025"
              autoComplete="organization"
              disabled={busy}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <OnboardingStepActions
            onBack={onBackToProfile}
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
          <button
            type="button"
            disabled={busy}
            onClick={handleSkip}
            className="w-full rounded-lg border border-neutral-300 bg-transparent px-4 py-2.5 text-sm font-medium text-neutral-800 transition-opacity hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800/60"
          >
            {skipping ? "Skipping…" : "Skip for now"}
          </button>
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
