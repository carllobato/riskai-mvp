"use client";

import { supabaseBrowserClient } from "@/lib/supabase/browser";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await supabaseBrowserClient().auth.signOut();
        window.location.href = "/login";
      }}
      className="inline-flex px-4 py-2 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
    >
      Sign out
    </button>
  );
}
