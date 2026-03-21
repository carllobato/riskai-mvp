"use client";

import type { ReactNode } from "react";

type Props = {
  /** Omit on the first step (e.g. profile). */
  onBack?: () => void;
  backLabel?: string;
  /** Primary action (usually a submit button). */
  forwardSlot: ReactNode;
  busy?: boolean;
};

/**
 * Shared footer for onboarding modals: optional Back + primary forward control.
 */
export function OnboardingStepActions({
  onBack,
  backLabel = "Back",
  forwardSlot,
  busy,
}: Props) {
  if (!onBack) {
    return <div className="mt-6 space-y-3">{forwardSlot}</div>;
  }

  return (
    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
      <button
        type="button"
        onClick={onBack}
        disabled={busy}
        className="rounded-lg border border-neutral-300 bg-transparent px-4 py-2.5 text-sm font-medium text-neutral-800 transition-opacity hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800/60 sm:min-w-[100px]"
      >
        {backLabel}
      </button>
      <div className="min-w-0 flex-1 sm:max-w-sm sm:flex-none">{forwardSlot}</div>
    </div>
  );
}
