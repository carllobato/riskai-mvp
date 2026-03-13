"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { useProjectionScenario } from "@/context/ProjectionScenarioContext";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";

const ACTIVE_PROJECT_KEY = "activeProjectId";

function projectIdFromPathname(pathname: string | null): string | null {
  if (!pathname || typeof pathname !== "string") return null;
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "projects" || !segments[1]) return null;
  return segments[1];
}

function getActiveProjectIdFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

const isDev = process.env.NODE_ENV === "development";

const CogIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/** When projectSlug is set, href is /projects/[id]/[projectSlug]; else use legacy href. */
const ALL_NAV_ITEMS: {
  href: string;
  projectSlug?: "setup" | "risks" | "outputs" | "simulation";
  label: string;
  icon?: "cog";
  hideInMvp?: boolean;
}[] = [
  { href: "/project", projectSlug: "setup", label: "Settings", icon: "cog" },
  { href: "/risk-register", projectSlug: "risks", label: "Risk Register" },
  { href: "/matrix", label: "Risk Matrix", hideInMvp: true },
  { href: "/outputs", projectSlug: "outputs", label: "Outputs", hideInMvp: true },
  { href: "/simulation", projectSlug: "simulation", label: "Simulation" },
  { href: "/analysis", label: "Analysis", hideInMvp: true },
  { href: "/day0", label: "Day 0", hideInMvp: true },
  ...(isDev ? [{ href: "/dev/health", label: "Engine Health", hideInMvp: true }] : []),
];

function navHref(item: (typeof ALL_NAV_ITEMS)[number], projectId: string | null): string {
  if (item.projectSlug && projectId) return `/projects/${projectId}/${item.projectSlug}`;
  return item.href;
}

export function NavBar() {
  const pathname = usePathname();
  const currentProjectId = projectIdFromPathname(pathname);
  const [activeProjectIdFromStorage, setActiveProjectIdFromStorage] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { uiMode } = useProjectionScenario();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setActiveProjectIdFromStorage(getActiveProjectIdFromStorage());
  }, [pathname]);

  // On project-not-found, do not use storage so nav links go to legacy routes or home, not the invalid project.
  const projectIdForNav =
    pathname === "/project-not-found" ? currentProjectId : (currentProjectId ?? activeProjectIdFromStorage);
  const homeHref = projectIdForNav ? `/projects/${projectIdForNav}/risks` : "/";

  return (
    <nav className="sticky top-0 z-50 flex items-center gap-6 px-6 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-[var(--background)] shadow-sm">
      <Link
        href={homeHref}
        className="text-lg font-semibold text-[var(--foreground)] no-underline shrink-0 hover:opacity-80 transition-opacity"
      >
        RiskAI
      </Link>

      <div className="flex items-center gap-1">
        {ALL_NAV_ITEMS.filter((item) => !(item.hideInMvp && uiMode === "MVP")).map((item) => {
          const href = navHref(item, projectIdForNav);
          const isActive = pathname === href;
          return (
            <Link
              key={item.projectSlug ? `${item.projectSlug}-${item.href}` : item.href}
              href={href}
              className={`
                inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium no-underline transition-colors
                ${isActive
                  ? "bg-neutral-200 dark:bg-neutral-700 text-[var(--foreground)] underline underline-offset-4"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)] hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }
              `}
            >
              {item.icon === "cog" && <CogIcon />}
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-3 shrink-0">
        <ProjectSwitcher currentProjectId={currentProjectId ?? projectIdForNav ?? undefined} />
        <button
          type="button"
          onClick={async () => {
            await supabaseBrowserClient().auth.signOut();
            window.location.href = "/login";
          }}
          className="px-3 py-2 rounded-md text-sm font-medium border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
        >
          Logout
        </button>
        {mounted ? (
          <button
            type="button"
            role="switch"
            aria-checked={theme === "dark"}
            aria-label="Toggle theme"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
            className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 p-0.5 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-[var(--background)]"
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-neutral-300 dark:bg-neutral-500 shadow-sm transition-transform duration-200 ease-out ${
                theme === "dark" ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        ) : (
          <span className="inline-block h-5 w-9 shrink-0 rounded-full border border-neutral-300 bg-neutral-200" aria-hidden />
        )}
      </div>
    </nav>
  );
}
