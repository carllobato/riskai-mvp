import type { ReactNode } from "react";

/**
 * Top-of-page permission explainer for settings routes (view-only or partial access).
 */
export function SettingsPermissionNotice({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 rounded-md border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/40 px-3 py-2"
      role="status"
    >
      {children}
    </p>
  );
}
