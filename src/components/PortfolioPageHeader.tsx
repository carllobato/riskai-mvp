import Link from "next/link";
import { riskaiPath } from "@/lib/routes";

type PortfolioPageHeaderProps = {
  portfolioId: string;
  portfolioName: string;
};

/**
 * Page header for portfolio routes. Displays the portfolio name as a link to portfolio overview.
 */
export function PortfolioPageHeader({ portfolioId, portfolioName }: PortfolioPageHeaderProps) {
  return (
    <header className="h-[61px] flex items-center border-b border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-4 sm:px-6 shrink-0">
      <h1 className="text-xl font-semibold text-[var(--foreground)] truncate m-0">
        <Link
          href={riskaiPath(`/portfolios/${portfolioId}`)}
          className="text-[var(--foreground)] hover:underline focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-[var(--background)] rounded"
        >
          {portfolioName}
        </Link>
      </h1>
    </header>
  );
}
