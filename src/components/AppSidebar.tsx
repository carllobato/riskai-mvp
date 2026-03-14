"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import type { User } from "@supabase/supabase-js";

const LOGIN_URL = "/login?next=" + encodeURIComponent("/");

/** True if pathname is a known app route (not a 404). */
function isKnownAppRoute(pathname: string | null): boolean {
  if (!pathname || typeof pathname !== "string") return false;
  if (pathname === "/") return true;
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/projects")) return true;
  if (pathname.startsWith("/portfolios")) return true;
  if (pathname.startsWith("/create-project")) return true;
  if (pathname.startsWith("/project-not-found")) return true;
  if (pathname === "/404") return true;
  if (pathname === "/settings") return true;
  if (pathname.startsWith("/dev")) return true;
  return false;
}

function getPortfolioIdFromPathname(pathname: string | null): string | null {
  if (!pathname || !pathname.startsWith("/portfolios/")) return null;
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "portfolios" || !segments[1]) return null;
  return segments[1];
}

function getProjectIdFromPathname(pathname: string | null): string | null {
  if (!pathname || !pathname.startsWith("/projects/")) return null;
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "projects" || !segments[1]) return null;
  return segments[1];
}

const CogIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
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
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
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
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const PortfolioIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const FolderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </svg>
);

const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
  </svg>
);

const ProjectsListIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="M8 6h13" />
    <path d="M8 12h13" />
    <path d="M8 18h13" />
    <path d="M3 6h.01" />
    <path d="M3 12h.01" />
    <path d="M3 18h.01" />
  </svg>
);

const RiskIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const SimulationIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

const DashboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <rect width="7" height="9" x="3" y="3" rx="1" />
    <rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" />
    <rect width="7" height="5" x="3" y="16" rx="1" />
  </svg>
);

const GLOBAL_NAV: { href: string; label: string; icon: "home" }[] = [
  { href: "/", label: "Home", icon: "home" },
];

const PORTFOLIO_NAV = (portfolioId: string) => [
  { href: `/portfolios/${portfolioId}`, label: "Portfolio Overview", icon: "portfolio" as const },
  { href: `/portfolios/${portfolioId}/projects`, label: "Projects", icon: "projects" as const },
  { href: `/portfolios/${portfolioId}/settings`, label: "Portfolio Settings", icon: "cog" as const },
];

const PROJECT_NAV = (projectId: string) => [
  { href: `/projects/${projectId}`, label: "Project Overview", icon: "dashboard" as const },
  { href: `/projects/${projectId}/risks`, label: "Risks", icon: "risk" as const },
  { href: `/projects/${projectId}/simulation`, label: "Simulation", icon: "simulation" as const },
  { href: `/projects/${projectId}/settings`, label: "Project Settings", icon: "cog" as const },
];

const linkClassName = (isActive: boolean) =>
  "flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm font-medium no-underline transition-colors " +
  (isActive
    ? "bg-neutral-200 dark:bg-neutral-700 text-[var(--foreground)]"
    : "text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)] hover:bg-neutral-100 dark:hover:bg-neutral-800");

const sectionLabelClassName = "px-3 pt-6 pb-2 text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]";

type NavLinkProps = {
  href: string;
  children: React.ReactNode;
  isActive: boolean;
  useFullPageLink: boolean;
};

function NavLink({ href, children, isActive, useFullPageLink }: NavLinkProps) {
  const className = linkClassName(isActive);
  if (useFullPageLink) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null | "loading">("loading");
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const isLoggedIn = user !== null && user !== "loading";
  const useFullPageLinks = !isKnownAppRoute(pathname);
  const portfolioIdFromUrl = getPortfolioIdFromPathname(pathname);
  const projectId = getProjectIdFromPathname(pathname);
  const [portfolioIdForProject, setPortfolioIdForProject] = useState<string | null>(null);
  const homeHref = isLoggedIn ? "/" : LOGIN_URL;

  // When viewing a project, fetch its portfolio_id so we can show portfolio nav (Projects, Settings) in the sidebar
  useEffect(() => {
    if (!projectId) {
      setPortfolioIdForProject(null);
      return;
    }
    let cancelled = false;
    supabaseBrowserClient()
      .from("projects")
      .select("portfolio_id")
      .eq("id", projectId)
      .single()
      .then(
        ({ data }) => {
          if (!cancelled && data?.portfolio_id) setPortfolioIdForProject(data.portfolio_id);
          else if (!cancelled) setPortfolioIdForProject(null);
        },
        () => {
          if (!cancelled) setPortfolioIdForProject(null);
        }
      );
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const portfolioId = portfolioIdFromUrl ?? portfolioIdForProject;

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

  return (
    <aside className="sticky top-0 self-start flex h-screen flex-col w-56 overflow-hidden border-r border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[var(--background)] shrink-0">
      {/* Logo - height and background match page header (61px), grey bar */}
      <div className="h-[61px] flex items-center px-4 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 shrink-0">
        {useFullPageLinks ? (
          <a href={homeHref} className="text-lg font-semibold text-[var(--foreground)] no-underline hover:opacity-80 transition-opacity">
            RiskAI
          </a>
        ) : (
          <Link href={homeHref} className="text-lg font-semibold text-[var(--foreground)] no-underline hover:opacity-80 transition-opacity">
            RiskAI
          </Link>
        )}
      </div>

      {/* Global nav - always visible */}
      <nav className="flex-1 overflow-y-auto p-2">
        <div className={sectionLabelClassName}>App</div>
        <ul className="space-y-0.5">
          {GLOBAL_NAV.map((item) => {
            const href = item.href === "/" ? homeHref : item.href;
            const isActive = pathname === item.href;
            const icon = <PortfolioIcon />;
            return (
              <li key={item.href}>
                <NavLink href={href} isActive={isActive} useFullPageLink={useFullPageLinks}>
                  {icon}
                  {item.label}
                </NavLink>
              </li>
            );
          })}
        </ul>

        {/* Portfolio contextual section */}
        {portfolioId && (
          <>
            <div className={sectionLabelClassName}>Portfolio</div>
            <ul className="space-y-0.5">
              {PORTFOLIO_NAV(portfolioId).map((item) => {
                const isActive = pathname === item.href;
                const icon = item.icon === "portfolio" ? <PortfolioIcon /> : item.icon === "projects" ? <ProjectsListIcon /> : item.icon === "cog" ? <CogIcon /> : <FileIcon />;
                return (
                  <li key={item.href}>
                    <NavLink href={item.href} isActive={isActive} useFullPageLink={useFullPageLinks}>
                      {icon}
                      {item.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {/* Project contextual section */}
        {projectId && (
          <>
            <div className={sectionLabelClassName}>Project</div>
            <ul className="space-y-0.5">
              {PROJECT_NAV(projectId).map((item) => {
                const isActive = pathname === item.href;
                const icon =
                  item.icon === "dashboard" ? <DashboardIcon /> :
                  item.icon === "risk" ? <RiskIcon /> :
                  item.icon === "simulation" ? <SimulationIcon /> :
                  <CogIcon />;
                return (
                  <li key={item.href}>
                    <NavLink href={item.href} isActive={isActive} useFullPageLink={useFullPageLinks}>
                      {icon}
                      {item.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>

      {/* Bottom: theme + user - grey to match top bar */}
      <div className="p-2 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 flex flex-col gap-1">
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
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-[var(--foreground)]"
          >
            {theme === "dark" ? <MoonIcon /> : <SunIcon />}
            <span>{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
        ) : (
          <span className="inline-block h-9 px-3 rounded-md bg-neutral-100 dark:bg-neutral-800" aria-hidden />
        )}
        {isLoggedIn ? (
          <>
            <Link
              href="/settings"
              className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-[var(--foreground)] no-underline"
            >
              <CogIcon />
              <span>Account Settings</span>
            </Link>
            <button
              type="button"
              onClick={async () => {
                await supabaseBrowserClient().auth.signOut();
                window.location.href = "/login";
              }}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-[var(--foreground)] text-left"
            >
              <UserIcon />
              <span>Log out</span>
            </button>
          </>
        ) : useFullPageLinks ? (
          <a
            href={LOGIN_URL}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-[var(--foreground)] no-underline"
          >
            <UserIcon />
            <span>Log in</span>
          </a>
        ) : (
          <Link
            href={LOGIN_URL}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-[var(--foreground)] no-underline"
          >
            <UserIcon />
            <span>Log in</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
