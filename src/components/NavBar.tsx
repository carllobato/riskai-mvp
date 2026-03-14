"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { useProjectionScenario } from "@/context/ProjectionScenarioContext";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import type { User } from "@supabase/supabase-js";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";

const LOGIN_URL = "/login?next=" + encodeURIComponent("/");

function projectIdFromPathname(pathname: string | null): string | null {
  if (!pathname || typeof pathname !== "string") return null;
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "projects" || !segments[1]) return null;
  return segments[1];
}

/** True if pathname is a known app route (not a 404). */
function isKnownAppRoute(pathname: string | null): boolean {
  if (!pathname || typeof pathname !== "string") return false;
  if (pathname === "/") return true;
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/projects")) return true;
  if (pathname.startsWith("/portfolios")) return true;
  if (pathname.startsWith("/create-project")) return true;
  if (pathname.startsWith("/project-not-found")) return true;
  if (pathname.startsWith("/dev")) return true;
  return false;
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
  { href: "/portfolios", label: "Portfolios" },
  { href: "/project", projectSlug: "setup", label: "Settings", icon: "cog" },
  { href: "/risk-register", projectSlug: "risks", label: "Risk Register" },
  { href: "/matrix", label: "Risk Matrix", hideInMvp: true },
  { href: "/outputs", projectSlug: "outputs", label: "Outputs", hideInMvp: true },
  { href: "/simulation", projectSlug: "simulation", label: "Simulation" },
  { href: "/analysis", label: "Analysis", hideInMvp: true },
  { href: "/day0", label: "Day 0", hideInMvp: true },
  ...(isDev ? [{ href: "/dev/health", label: "Engine Health", hideInMvp: true }] : []),
];

function isValidProjectId(id: string | null | undefined): id is string {
  return typeof id === "string" && id !== "undefined" && id.trim().length > 0;
}

function navHref(
  item: (typeof ALL_NAV_ITEMS)[number],
  projectId: string | null,
  isLoggedIn: boolean
): string {
  if (!isLoggedIn) return LOGIN_URL;
  if (item.projectSlug && isValidProjectId(projectId)) return "/projects/" + projectId + "/" + item.projectSlug;
  if (item.projectSlug) return "/projects";
  return item.href;
}

export function NavBar() {
  const pathname = usePathname();
  const currentProjectId = projectIdFromPathname(pathname);
  const [user, setUser] = useState<User | null | "loading">("loading");
  const { theme, toggleTheme } = useTheme();
  const { uiMode } = useProjectionScenario();
  const [mounted, setMounted] = useState(false);
  const isLoggedIn = user !== null && user !== "loading";

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const supabase = supabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Use only the project ID from the URL for nav links. When not on a project page (e.g. /projects list,
  // create-project), do not use the last-loaded project from storage so Risk Register etc. don't link into a project.
  const isUnknownRoute = !isKnownAppRoute(pathname);
  const projectIdForNav = currentProjectId;
  // Logo: project list when logged in, login when logged out.
  const homeHref = isLoggedIn ? "/projects" : LOGIN_URL;

  // On 404, use full-page links so leaving the page remounts the app and restores the nav.
  const useFullPageLinks = isUnknownRoute;

  const logoClassName = "text-lg font-semibold text-[var(--foreground)] no-underline shrink-0 hover:opacity-80 transition-opacity";
  const navLinkClassName = (isActive: boolean) =>
    "inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium no-underline transition-colors " +
    (isActive
      ? "bg-neutral-200 dark:bg-neutral-700 text-[var(--foreground)] underline underline-offset-4"
      : "text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)] hover:bg-neutral-100 dark:hover:bg-neutral-800");

  return (
    <nav className="sticky top-0 z-50 flex items-center gap-6 px-6 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-[var(--background)] shadow-sm">
      {useFullPageLinks ? (
        <a href={homeHref} className={logoClassName}>
          RiskAI
        </a>
      ) : (
        <Link href={homeHref} className={logoClassName}>
          RiskAI
        </Link>
      )}

      <div className="flex items-center gap-1">
        {ALL_NAV_ITEMS.filter((item) => !(item.hideInMvp && uiMode === "MVP")).map((item) => {
          const href = navHref(item, projectIdForNav, isLoggedIn);
          const isActive = !!currentProjectId && pathname === href;
          const itemKey = item.projectSlug ? item.projectSlug + "-" + item.href : item.href;
          if (useFullPageLinks) {
            return (
              <a
                key={itemKey}
                href={href}
                className={navLinkClassName(isActive)}
              >
                {item.icon === "cog" && <CogIcon />}
                {item.label}
              </a>
            );
          }
          return (
            <Link
              key={itemKey}
              href={href}
              className={navLinkClassName(isActive)}
            >
              {item.icon === "cog" && <CogIcon />}
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-3 shrink-0">
        {isLoggedIn && !useFullPageLinks && (
          <ProjectSwitcher
            currentProjectId={isValidProjectId(currentProjectId) ? currentProjectId : undefined}
          />
        )}
        {isLoggedIn ? (
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
        ) : useFullPageLinks ? (
          <a
            href={LOGIN_URL}
            className="px-3 py-2 rounded-md text-sm font-medium border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 no-underline"
          >
            Log in
          </a>
        ) : (
          <Link
            href={LOGIN_URL}
            className="px-3 py-2 rounded-md text-sm font-medium border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 no-underline"
          >
            Log in
          </Link>
        )}
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
              className={
                "pointer-events-none inline-block h-4 w-4 rounded-full bg-neutral-300 dark:bg-neutral-500 shadow-sm transition-transform duration-200 ease-out " +
                (theme === "dark" ? "translate-x-4" : "translate-x-0")
              }
            />
          </button>
        ) : (
          <span className="inline-block h-5 w-9 shrink-0 rounded-full border border-neutral-300 bg-neutral-200" aria-hidden />
        )}
      </div>
    </nav>
  );
}
