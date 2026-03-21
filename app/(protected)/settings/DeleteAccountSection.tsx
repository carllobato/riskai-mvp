"use client";

import { useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        if (res.status === 503 && data.code === "SERVICE_ROLE_MISSING") {
          setError(
            "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase → Project Settings → API → service_role secret), then restart the dev server. On Vercel, add the same variable under Project → Settings → Environment Variables and redeploy."
          );
        } else {
          setError(data.error ?? "Could not delete account.");
        }
        setDeleting(false);
        return;
      }
      await supabaseBrowserClient().auth.signOut();
      window.location.href = "/login";
    } catch {
      setError("Something went wrong. Try again.");
      setDeleting(false);
    }
  }

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-medium text-[var(--foreground)]">Danger zone</h2>
      <div className="rounded-lg border border-red-200 bg-red-50/40 p-4 dark:border-red-900/50 dark:bg-red-950/20">
        <p className="mb-3 text-sm text-neutral-700 dark:text-neutral-300">
          Permanently delete your account and associated access. This does not remove data owned by
          organisations you were invited to unless your user record is the only link — confirm with
          your admin if unsure.
        </p>
        <p className="mb-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          <span className="font-medium text-neutral-600 dark:text-neutral-300">Setup (self-hosted / local):</span> add{" "}
          <code className="rounded bg-neutral-200/80 px-1 py-0.5 font-mono text-[11px] dark:bg-neutral-800">
            SUPABASE_SERVICE_ROLE_KEY
          </code>{" "}
          to <code className="rounded bg-neutral-200/80 px-1 py-0.5 font-mono text-[11px] dark:bg-neutral-800">.env.local</code>{" "}
          (Supabase → Project Settings → API → <span className="whitespace-nowrap">service_role</span> secret), then
          restart the dev server. On Vercel, add the same variable under Project → Settings → Environment Variables and
          redeploy.
        </p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/70"
        >
          Delete account
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          aria-describedby="delete-account-desc"
          onClick={() => !deleting && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-neutral-200/90 bg-[var(--background)] p-6 shadow-xl dark:border-neutral-700/90"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="delete-account-title"
              className="text-lg font-semibold tracking-tight text-[var(--foreground)]"
            >
              Delete account?
            </h3>
            <p id="delete-account-desc" className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Are you sure? This can&apos;t be undone. Your sign-in will be removed and you will lose
              access to this account immediately.
            </p>
            {error && (
              <p
                className="mt-3 text-sm leading-relaxed text-red-600 dark:text-red-400"
                role="alert"
              >
                {error}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setOpen(false)}
                className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
              >
                {deleting ? "Deleting…" : "Yes, delete my account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
