"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

export default function DevSignOutClient() {
  const router = useRouter();

  const handleSignOut = async () => {
    await supabaseBrowserClient().auth.signOut();
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] hover:bg-neutral-100 dark:hover:bg-neutral-700 text-sm font-medium"
    >
      Sign Out
    </button>
  );
}
