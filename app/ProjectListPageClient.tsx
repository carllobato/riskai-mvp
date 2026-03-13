"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import type { ProjectRow } from "@/lib/projects";
import { fetchProjectsClient } from "@/lib/projects";

const PROJECTS_PATH = "/projects";

export function ProjectListPageClient() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [projects, setProjects] = useState<ProjectRow[]>([]);

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

      const result = await fetchProjectsClient();
      if (cancelled) return;
      if (!result.ok) {
        setStatus("error");
        return;
      }
      setProjects(result.projects);
      setStatus("ready");
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === "loading") {
    return (
      <main className="min-h-[40vh] flex flex-col items-center justify-center px-4">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-[40vh] flex flex-col items-center justify-center px-4">
        <p className="text-sm text-red-600 dark:text-red-400">Failed to load projects.</p>
        <Link href={PROJECTS_PATH} className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 underline hover:no-underline">
          Try again
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-1">
        Projects
      </h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-8">
        Your projects. Open one to manage risks or create a new project.
      </p>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 p-6 text-center">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            You don't have any projects yet.
          </p>
          <Link
            href="/create-project"
            className="inline-flex px-4 py-2 text-sm font-medium rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
          >
            Create your first project
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-2 mb-6">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}/risks`}
                  className="block px-4 py-3 rounded-md border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] text-[var(--foreground)] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  <span className="font-medium">{p.name || p.id}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/create-project"
            className="inline-flex px-4 py-2 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
          >
            + New project
          </Link>
        </>
      )}
    </main>
  );
}
