"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ACTIVE_PROJECT_KEY = "activeProjectId";

type ProjectSlug = "setup" | "risks" | "simulation";

/**
 * Redirects legacy routes to project-scoped URLs or home.
 * Use as the default export of /project, /risk-register, /simulation pages.
 */
export function RedirectToProjectRoute({ slug }: { slug: ProjectSlug }) {
  const router = useRouter();

  useEffect(() => {
    const activeId =
      typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_PROJECT_KEY) : null;
    if (activeId) {
      router.replace(`/projects/${activeId}/${slug}`);
    } else {
      router.replace("/");
    }
  }, [router, slug]);

  return (
    <main className="min-h-[20vh] flex flex-col items-center justify-center px-4">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">Redirecting…</p>
    </main>
  );
}
