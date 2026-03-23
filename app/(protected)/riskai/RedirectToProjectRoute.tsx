"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DASHBOARD_PATH, riskaiPath } from "@/lib/routes";

const ACTIVE_PROJECT_KEY = "activeProjectId";

type ProjectSlug = "project-home" | "risks" | "simulation";

/**
 * Redirects legacy routes to project-scoped URLs or home.
 * Use as the default export of /project, /risk-register, /simulation pages.
 */
export function RedirectToProjectRoute({ slug }: { slug: ProjectSlug }) {
  const router = useRouter();

  useEffect(() => {
    const raw =
      typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_PROJECT_KEY) : null;
    const activeId =
      typeof raw === "string" && raw !== "undefined" && raw.trim().length > 0 ? raw : null;
    if (activeId) {
      const path =
        slug === "project-home"
          ? riskaiPath("/projects/" + activeId)
          : riskaiPath("/projects/" + activeId + "/" + slug);
      router.replace(path);
    } else {
      router.replace(DASHBOARD_PATH);
    }
  }, [router, slug]);

  return (
    <main className="min-h-[20vh] flex flex-col items-center justify-center px-4">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">Redirecting…</p>
    </main>
  );
}
