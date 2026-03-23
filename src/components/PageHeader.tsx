import Link from "next/link";
import { riskaiPath } from "@/lib/routes";

const linkClass =
  "text-[var(--foreground)] hover:underline focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-[var(--background)] rounded";

type PageHeaderProps = {
  projectId: string;
  projectName: string;
  portfolioId?: string | null;
  portfolioName?: string | null;
};

/**
 * Page header for project routes. Shows "Portfolio Name – Project Name" when the project
 * is linked to a portfolio, otherwise just "Project Name". Portfolio name links to portfolio
 * overview; project name links to project overview.
 */
export function PageHeader({
  projectId,
  projectName,
  portfolioId,
  portfolioName,
}: PageHeaderProps) {
  return (
    <header className="h-[61px] flex items-center border-b border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-4 sm:px-6 shrink-0">
      <h1 className="text-xl font-semibold text-[var(--foreground)] truncate m-0 flex items-center gap-1 min-w-0">
        {portfolioName && portfolioId ? (
          <>
            <Link href={riskaiPath(`/portfolios/${portfolioId}`)} className={linkClass + " shrink-0"}>
              {portfolioName}
            </Link>
            <span className="shrink-0 text-neutral-500 dark:text-neutral-400" aria-hidden>
              {" | "}
            </span>
            <Link
              href={riskaiPath(`/projects/${projectId}`)}
              className={linkClass + " min-w-0 truncate"}
            >
              {projectName}
            </Link>
          </>
        ) : (
          <Link href={riskaiPath(`/projects/${projectId}`)} className={linkClass}>
            {projectName}
          </Link>
        )}
      </h1>
    </header>
  );
}
