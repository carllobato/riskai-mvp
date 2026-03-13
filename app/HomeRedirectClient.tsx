"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

const ACTIVE_PROJECT_KEY = "activeProjectId";

export function HomeRedirectClient() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "redirecting">("loading");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const supabase = supabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;
      if (!session?.user) {
        router.replace("/login?next=" + encodeURIComponent("/"));
        return;
      }

      setStatus("redirecting");
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) {
          router.replace("/login");
          return;
        }
        const { projects } = (await res.json()) as { projects: { id: string; name?: string; created_at?: string }[] };
        const list = Array.isArray(projects) ? projects : [];
        const activeId =
          typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_PROJECT_KEY) : null;
        const ownedIds = new Set(list.map((p) => p.id));
        // Only use activeId if it is in owned list so invalid/deleted project never redirects.
        const targetId =
          (activeId && ownedIds.has(activeId) ? activeId : null) ?? list[0]?.id ?? null;

        if (cancelled) return;
        if (targetId) {
          router.replace(`/projects/${targetId}/risks`);
        } else {
          router.replace("/create-project");
        }
      } catch {
        if (!cancelled) router.replace("/login");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-[40vh] flex flex-col items-center justify-center px-4">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {status === "loading" ? "Loading…" : "Redirecting…"}
      </p>
    </main>
  );
}
