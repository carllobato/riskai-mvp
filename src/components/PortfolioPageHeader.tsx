"use client";

import Link from "next/link";
import { riskaiPath } from "@/lib/routes";
import { usePageHeaderExtras } from "@/contexts/PageHeaderExtrasContext";

const linkClass =
  "text-[var(--foreground)] hover:underline focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-[var(--background)] rounded";

const titleSeparatorClass =
  "shrink-0 px-2 font-light text-neutral-400 dark:text-neutral-500";

type PortfolioPageHeaderProps = {
  portfolioId: string;
  portfolioName: string;
};

/**
 * Shell header for portfolio routes: `Portfolio name | Page` when a child registers a title suffix.
 * Styling matches {@link PageHeader} for consistency.
 */
export function PortfolioPageHeader({ portfolioId, portfolioName }: PortfolioPageHeaderProps) {
  const { extras } = usePageHeaderExtras();

  return (
    <>
      <header className="min-h-[61px] flex items-center justify-between gap-4 px-6 shrink-0">
        <h1 className="text-xl font-semibold text-[var(--foreground)] m-0 flex min-w-0 flex-1 items-center gap-1">
          <Link
            href={riskaiPath(`/portfolios/${portfolioId}`)}
            className={linkClass + " min-w-0 w-fit max-w-[min(100%,28rem)] shrink truncate"}
          >
            {portfolioName}
          </Link>
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
