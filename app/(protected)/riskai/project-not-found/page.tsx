"use client";

import { useEffect } from "react";
import Link from "next/link";
import { riskaiPath } from "@/lib/routes";

const ACTIVE_PROJECT_KEY = "activeProjectId";

export default function ProjectNotFoundPage() {
  // Clear stale active project so nav and "Go to projects" don't use the invalid ID.
  useEffect(() => {
    try {
      if (typeof window !== "undefined") window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
    } catch {
      // ignore
    }
  }, []);

  return (
    <main className="min-h-[40vh] flex flex-col items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200">
          Project not found or access denied
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          The project you’re looking for doesn’t exist or you don’t have access to it. Go to your projects to
          open one or create a new one.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href={riskaiPath("/projects")}
            className="px-4 py-2 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            Go to projects
          </Link>
          <Link
            href={riskaiPath("/create-project")}
            className="px-4 py-2 text-sm font-medium rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
          >
            Create project
          </Link>
        </div>
      </div>
    </main>
  );
}
