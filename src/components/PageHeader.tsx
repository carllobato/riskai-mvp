"use client";

import Link from "next/link";
import { riskaiPath } from "@/lib/routes";
import { useProjectPageHeaderExtras } from "@/contexts/ProjectPageHeaderContext";

const linkClass =
  "text-[var(--foreground)] hover:underline focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-[var(--background)] rounded";

const titleSeparatorClass =
  "shrink-0 px-2 font-light text-neutral-400 dark:text-neutral-500";

type PageHeaderProps = {
  projectId: string;
  projectName: string;
  portfolioId?: string | null;
  portfolioName?: string | null;
};

/**
 * Page header for project routes. Shows "Portfolio Name – Project Name" when the project
 * is linked to a portfolio, otherwise just "Project Name". Portfolio name links to portfolio
 * overview; project name links to project overview. Child routes may register an optional
 * title suffix and trailing content via `ProjectPageHeaderExtrasProvider`.
 */
export function PageHeader({
  projectId,
  projectName,
  portfolioId,
  portfolioName,
}: PageHeaderProps) {
  const { extras } = useProjectPageHeaderExtras();

  return (
    <>
      <header className="min-h-[61px] flex items-center justify-between gap-4 px-6 shrink-0">
        <h1 className="text-xl font-semibold text-[var(--foreground)] m-0 flex min-w-0 flex-1 items-center gap-1">
          {portfolioName && portfolioId ? (
            <>
              <Link href={riskaiPath(`/portfolios/${portfolioId}`)} className={linkClass + " shrink-0"}>
                {portfolioName}
              </Link>
              <span className={titleSeparatorClass} aria-hidden>
                |
              </span>
              <Link
                href={riskaiPath(`/projects/${projectId}`)}
                className={
                  linkClass +
                  " min-w-0 w-fit max-w-[min(100%,28rem)] shrink truncate"
                }
              >
                {projectName}
              </Link>
            </>
          ) : (
            <Link
              href={riskaiPath(`/projects/${projectId}`)}
              className={
                linkClass + " min-w-0 w-fit max-w-[min(100%,28rem)] shrink truncate"
              }
            >
              {projectName}
            </Link>
          )}
          {extras?.titleSuffix ? (
            <>
              <span className={titleSeparatorClass} aria-hidden>
                |
              </span>
              <span className="shrink-0 text-[var(--foreground)]">{extras.titleSuffix}</span>
            </>
          ) : null}
        </h1>
        {extras?.end ? (
          <div className="flex shrink-0 flex-col gap-1 text-sm text-neutral-600 dark:text-neutral-300 sm:items-end sm:text-right">
            {extras.end}
          </div>
        ) : null}
      </header>
      <div className="w-full shrink-0 px-6">
        <div
          className="h-px w-full bg-neutral-200 dark:bg-neutral-700"
          aria-hidden
        />
      </div>
    </>
  );
}
