/**
 * Shared layout and control styling for Project Settings and Portfolio Settings.
 */

export const settingsCardClass =
  "rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4 sm:p-5";

/** Section heading inside a settings card (h2). */
export const settingsSectionTitleClass =
  "text-base font-semibold text-[var(--foreground)] mb-3 border-b border-neutral-200 dark:border-neutral-700 pb-2";

/** Section heading outside a card (e.g. read-only meta block). */
export const settingsStandaloneSectionTitleClass =
  "text-base font-semibold text-[var(--foreground)] mb-3";

export const settingsLabelClass =
  "block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1";

/** Single-line inputs and selects (members table row selects use h-9 via extra class). */
export const settingsInputClass =
  "w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 h-10";

export const settingsTextareaClass =
  "w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 min-h-10";

export const settingsInputErrorClass =
  "w-full rounded-md border-2 border-red-500 dark:border-red-400 bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 dark:focus:ring-red-500 min-h-10";

export const settingsInputErrorClassSingleLine =
  "w-full rounded-md border-2 border-red-500 dark:border-red-400 bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 dark:focus:ring-red-500 h-10";

/** Append when a field is read-only or disabled due to permissions. */
export const settingsFieldLockedClass = "opacity-90 cursor-not-allowed";

export const settingsPrimaryButtonClass =
  "px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed";

export const settingsMemberAddButtonClass =
  "h-10 px-4 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed";
