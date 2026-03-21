"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

const ACTIVE_PROJECT_KEY = "activeProjectId";

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

const PanelLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
  </svg>
);

/** Pushpin — use when rail is collapsed (hover-only) to suggest “pin open”. */
const PinOpenIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0"
    aria-hidden
  >
    <path d="M12 17v5" />
    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v3.76Z" />
  </svg>
);

const LayoutGridIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden>
    <rect width="7" height="9" x="3" y="3" rx="1" />
    <rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" />
    <rect width="7" height="5" x="3" y="16" rx="1" />
  </svg>
);

const BriefcaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden>
    <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
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

const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
  </svg>
);

const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden>
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

const AnalysisIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
    <path d="M10 9H8" />
  </svg>
);

type SidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  /** When rail is collapsed, hover temporarily expands labels/width (desktop hover). */
  const [hoverPeek, setHoverPeek] = useState(false);
  const hoverLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!collapsed) setHoverPeek(false);
  }, [collapsed]);

  useEffect(
    () => () => {
      if (hoverLeaveTimerRef.current) clearTimeout(hoverLeaveTimerRef.current);
    },
    []
  );

  const visuallyCollapsed = collapsed && !hoverPeek;
  const portfolioIdFromUrl = getPortfolioIdFromPathname(pathname);
  const projectIdFromUrl = getProjectIdFromPathname(pathname);
  const projectIdFromUrlRef = useRef(projectIdFromUrl);
  projectIdFromUrlRef.current = projectIdFromUrl;
  const [portfolioIdForProject, setPortfolioIdForProject] = useState<string | null>(null);
  const [projectIdFromStorage, setProjectIdFromStorage] = useState<string | null>(null);

  const supabase = useMemo(() => supabaseBrowserClient(), []);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_PROJECT_KEY) : null;
      const id =
        typeof raw === "string" && raw !== "undefined" && raw.trim().length > 0 ? raw.trim() : null;
      setProjectIdFromStorage(id);
    } catch {
      setProjectIdFromStorage(null);
    }
  }, [pathname]);

  useEffect(() => {
    if (!projectIdFromUrl) {
      setPortfolioIdForProject(null);
      return;
    }
    let cancelled = false;
    const requestedId = projectIdFromUrl;
    supabase
      .from("projects")
      .select("portfolio_id")
      .eq("id", requestedId)
      .single()
      .then(({ data, error }) => {
        if (cancelled || projectIdFromUrlRef.current !== requestedId) return;
        if (error || !data?.portfolio_id) {
          setPortfolioIdForProject(null);
          return;
        }
        setPortfolioIdForProject(data.portfolio_id);
      });
    return () => {
      cancelled = true;
    };
  }, [projectIdFromUrl, supabase]);

  const portfolioId = portfolioIdFromUrl ?? portfolioIdForProject;
  const projectId = projectIdFromUrl ?? projectIdFromStorage;

  /** Portfolio nav: only on a portfolio route, or on a project that belongs to a portfolio. */
  const showPortfolioNav =
    portfolioIdFromUrl != null || portfolioIdForProject != null;

  /** Project nav: only while viewing a project URL (`/projects/[id]/…`). */
  const projectIdInUrl = getProjectIdFromPathname(pathname);
  const showProjectNav = projectIdInUrl != null;
  const projectNavBase = projectIdInUrl ? `/projects/${projectIdInUrl}` : null;

  const portfolioOverviewHref = portfolioId ? `/portfolios/${portfolioId}` : "/portfolios";
  const projectBase = projectId ? `/projects/${projectId}` : null;

  const dashboardActive = pathname === "/";
  const portfolioOverviewActive =
    portfolioId != null &&
    (pathname === `/portfolios/${portfolioId}` || pathname === `/portfolios/${portfolioId}/`);
  const portfolioProjectsActive =
    portfolioId != null && pathname.startsWith(`/portfolios/${portfolioId}/projects`);

  const projectOverviewActive =
    projectBase != null &&
    (pathname === projectBase || pathname === `${projectBase}/`);
  const runDataActive = projectBase != null && pathname.startsWith(`${projectBase}/run-data`);
  const risksActive = projectBase != null && pathname.startsWith(`${projectBase}/risks`);
  const simulationActive =
    projectNavBase != null && pathname.startsWith(`${projectNavBase}/simulation`);
  const analysisActive = pathname === "/analysis" || pathname.startsWith("/analysis/");

  const navTransition = "duration-200 ease-out";

  const linkClass = (active: boolean, disabled?: boolean) =>
    "flex min-w-0 items-center gap-0 rounded-lg py-2 text-sm font-medium no-underline transition-colors px-3 " +
    (disabled
      ? "cursor-not-allowed text-neutral-400 dark:text-neutral-600"
      : active
        ? "bg-neutral-200/90 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
        : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white");

  /** Width, opacity, and margin animate together; margin replaces gap so spacing doesn’t jump. */
  const navLabelClass =
    "block min-w-0 overflow-hidden text-left whitespace-nowrap transition-[max-width,opacity,margin] " +
    navTransition +
    " " +
    (visuallyCollapsed
      ? "ml-0 max-w-0 opacity-0 pointer-events-none"
      : "ml-2 max-w-[min(12rem,100%)] opacity-100");

  /** Collapsed: horizontal rule through vertical center of the block (not top-aligned border). */
  const sectionHeader = (label: string, isFirst = false) => (
    <div
      className={
        "relative px-3 pb-2 pt-6 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 first:pt-2 dark:text-neutral-500 " +
        (!isFirst ? "mt-2" : "")
      }
    >
      {visuallyCollapsed ? (
        <div
          className="pointer-events-none absolute left-3 right-3 top-1/2 z-0 h-px -translate-y-1/2 bg-neutral-200 dark:bg-neutral-700"
          aria-hidden
        />
      ) : null}
      <span
        className={
          "relative z-10 block overflow-hidden whitespace-nowrap uppercase transition-[max-width,opacity] " +
          navTransition +
          " text-neutral-500 " +
          (visuallyCollapsed ? "max-w-0 opacity-0" : "max-w-[min(12rem,100%)] opacity-100")
        }
        aria-hidden={visuallyCollapsed}
      >
        {label}
      </span>
    </div>
  );

  const widthClass = visuallyCollapsed ? "w-[56px]" : "w-[240px]";

  const handleAsidePointerEnter = () => {
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
    if (collapsed) setHoverPeek(true);
  };

  const handleAsidePointerLeave = () => {
    hoverLeaveTimerRef.current = setTimeout(() => {
      setHoverPeek(false);
      hoverLeaveTimerRef.current = null;
    }, 80);
  };

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-label="Close navigation"
          onClick={onMobileClose}
        />
      ) : null}

      <aside
        className={
          "fixed bottom-0 left-0 top-14 z-50 flex flex-col border-r border-neutral-200 bg-neutral-50 transition-[transform,width] duration-200 ease-out will-change-[width] dark:border-neutral-800 dark:bg-neutral-900/80 md:static md:top-auto md:z-0 md:h-full " +
          widthClass +
          (collapsed && hoverPeek ? " shadow-lg ring-1 ring-neutral-200/80 dark:ring-neutral-700" : "") +
          (mobileOpen ? " translate-x-0" : " -translate-x-full md:translate-x-0")
        }
        onMouseEnter={handleAsidePointerEnter}
        onMouseLeave={handleAsidePointerLeave}
      >
        <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
          {sectionHeader("Main", true)}
          <ul className="space-y-0.5">
            <li>
              <Link href="/" className={linkClass(dashboardActive)} title={visuallyCollapsed ? "Dashboard" : undefined} onClick={onMobileClose}>
                <LayoutGridIcon />
                <span className={navLabelClass}>Dashboard</span>
              </Link>
            </li>
          </ul>

          {showPortfolioNav ? (
            <>
              {sectionHeader("Portfolio", false)}
              <ul className="space-y-0.5">
                <li>
                  <Link
                    href={portfolioOverviewHref}
                    className={linkClass(portfolioOverviewActive)}
                    title={visuallyCollapsed ? "Portfolio Overview" : undefined}
                    onClick={onMobileClose}
                  >
                    <BriefcaseIcon />
                    <span className={navLabelClass}>Portfolio Overview</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/portfolios/${portfolioId}/projects`}
                    className={linkClass(portfolioProjectsActive)}
                    title={visuallyCollapsed ? "Projects" : undefined}
                    onClick={onMobileClose}
                  >
                    <ProjectsListIcon />
                    <span className={navLabelClass}>Projects</span>
                  </Link>
                </li>
              </ul>
            </>
          ) : null}

          {showProjectNav && projectNavBase ? (
            <>
              {sectionHeader("Projects", false)}
              <ul className="space-y-0.5">
                <li>
                  <Link
                    href={projectNavBase}
                    className={linkClass(projectOverviewActive)}
                    title={visuallyCollapsed ? "Project Overview" : undefined}
                    onClick={onMobileClose}
                  >
                    <LayoutGridIcon />
                    <span className={navLabelClass}>Project Overview</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href={`${projectNavBase}/risks`}
                    className={linkClass(risksActive)}
                    title={visuallyCollapsed ? "Risks" : undefined}
                    onClick={onMobileClose}
                  >
                    <AlertIcon />
                    <span className={navLabelClass}>Risks</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href={`${projectNavBase}/run-data`}
                    className={linkClass(runDataActive)}
                    title={visuallyCollapsed ? "Run Data" : undefined}
                    onClick={onMobileClose}
                  >
                    <FileIcon />
                    <span className={navLabelClass}>Run Data</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href={`${projectNavBase}/simulation`}
                    className={linkClass(simulationActive)}
                    title={visuallyCollapsed ? "Simulation" : undefined}
                    onClick={onMobileClose}
                  >
                    <SimulationIcon />
                    <span className={navLabelClass}>Simulation</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/analysis"
                    className={linkClass(analysisActive)}
                    title={visuallyCollapsed ? "Analysis" : undefined}
                    onClick={onMobileClose}
                  >
                    <AnalysisIcon />
                    <span className={navLabelClass}>Analysis</span>
                  </Link>
                </li>
              </ul>
            </>
          ) : null}
        </nav>

        <div className="shrink-0 border-t border-neutral-200 p-2 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full min-w-0 items-center gap-0 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            aria-pressed={!collapsed}
            title={collapsed ? "Pin sidebar open" : "Collapse sidebar"}
            aria-label={collapsed ? "Pin sidebar open" : "Collapse sidebar"}
          >
            {collapsed ? <PinOpenIcon /> : <PanelLeftIcon />}
            <span className={navLabelClass}>{collapsed ? "Pin open" : "Collapse"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
