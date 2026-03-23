"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { useProjectionScenario } from "@/context/ProjectionScenarioContext";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import type { User } from "@supabase/supabase-js";
import {
  DASHBOARD_PATH,
  projectIdFromAppPathname,
  riskaiPath,
  RISKAI_BASE,
} from "@/lib/routes";

const LOGIN_URL = "/?next=" + encodeURIComponent(DASHBOARD_PATH);

/** True if pathname is a known app route (not a 404). */
function isKnownAppRoute(pathname: string | null): boolean {
  if (!pathname || typeof pathname !== "string") return false;
  if (pathname === "/" || pathname.startsWith("/privacy") || pathname.startsWith("/terms")) return true;
  if (pathname === DASHBOARD_PATH || pathname.startsWith(`${DASHBOARD_PATH}/`)) return true;
  if (pathname === RISKAI_BASE || pathname.startsWith(`${RISKAI_BASE}/`)) return true;
  if (pathname.startsWith("/login") || pathname === "/") return true;
  if (pathname === "/404") return true;
  return false;
}

const CogIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

/** When projectSlug is set, href is /projects/[id]/[projectSlug]; else use legacy href. */
const ALL_NAV_ITEMS: {
  href: string;
  projectSlug?: "project-home" | "risks" | "run-data" | "simulation" | "health";
  label: string;
  icon?: "cog" | "home";
  hideInMvp?: boolean;
}[] = [
  { href: riskaiPath("/portfolios"), label: "Portfolios" },
  { href: riskaiPath("/projects"), label: "Projects" },
  { href: riskaiPath("/projects"), projectSlug: "project-home", label: "Project Home", icon: "home" },
  { href: riskaiPath("/projects"), projectSlug: "risks", label: "Risk Register" },
  { href: riskaiPath("/matrix"), label: "Risk Matrix", hideInMvp: true },
  // TEMP: Run Data nav item for development audit – remove before production
  { href: riskaiPath("/dev/run-data"), projectSlug: "run-data", label: "Run Data" },
  { href: riskaiPath("/simulation"), projectSlug: "simulation", label: "Simulation" },
];

function isValidProjectId(id: string | null | undefined): id is string {
  return typeof id === "string" && id !== "undefined" && id.trim().length > 0;
}

function navHref(
  item: (typeof ALL_NAV_ITEMS)[number],
  projectId: string | null,
  _pathname: string | null,
  isLoggedIn: boolean
): string {
  if (!isLoggedIn) return LOGIN_URL;
  if (item.projectSlug && isValidProjectId(projectId)) {
    if (item.projectSlug === "project-home") return riskaiPath("/projects/" + projectId);
    return riskaiPath("/projects/" + projectId + "/" + item.projectSlug);
  }
  if (item.projectSlug) return riskaiPath("/projects");
  return item.href;
}

export function NavBar() {
  const pathname = usePathname();
  const currentProjectId = projectIdFromAppPathname(pathname);
  const [user, setUser] = useState<User | null | "loading">("loading");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { uiMode } = useProjectionScenario();
  const [mounted, setMounted] = useState(false);
  const isLoggedIn = user !== null && user !== "loading";

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const supabase = supabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null);
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
  const homeHref = isLoggedIn ? DASHBOARD_PATH : LOGIN_URL;

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
          const href = navHref(item, projectIdForNav, pathname, isLoggedIn);
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
                {item.icon === "home" && <HomeIcon />}
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
                {item.icon === "home" && <HomeIcon />}
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-3 shrink-0">
        {mounted ? (
          <button
            type="button"
            role="switch"
            aria-checked={theme === "dark"}
            aria-label="Toggle theme"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={(e) => {
              toggleTheme();
              (e.currentTarget as HTMLButtonElement).blur();
            }}
            className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 p-0.5 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
          >
            <span className="pointer-events-none absolute left-0.5 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400">
              <SunIcon />
            </span>
            <span className="pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400">
              <MoonIcon />
            </span>
            <span
              className={
                "pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-neutral-300 dark:bg-neutral-500 shadow-sm transition-transform duration-200 ease-out " +
                (theme === "dark" ? "translate-x-4" : "translate-x-0")
              }
            />
          </button>
        ) : (
          <span className="inline-block h-5 w-9 shrink-0 rounded-full border border-neutral-300 bg-neutral-200" aria-hidden />
        )}
        <div
          className="relative shrink-0"
          onMouseEnter={() => setUserMenuOpen(true)}
          onMouseLeave={() => setUserMenuOpen(false)}
        >
          <button
            type="button"
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
            aria-label="User menu"
            title={isLoggedIn ? "Account" : "Log in"}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-[var(--background)]"
          >
            <UserIcon />
          </button>
          {userMenuOpen && (
            <div
              className="absolute right-0 top-full z-50 min-w-[10rem] rounded-md border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] pt-2 pb-1 shadow-lg"
              role="menu"
            >
              {isLoggedIn ? (
                <>
                  <Link
                    href={riskaiPath("/settings")}
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 no-underline"
                  >
                    Account settings
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={async () => {
                      setUserMenuOpen(false);
                      await supabaseBrowserClient().auth.signOut();
                      window.location.href = "/";
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Log out
                  </button>
                </>
              ) : useFullPageLinks ? (
                <a
                  href={LOGIN_URL}
                  role="menuitem"
                  className="block px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 no-underline"
                >
                  Log in
                </a>
              ) : (
                <Link
                  href={LOGIN_URL}
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 no-underline"
                >
                  Log in
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
