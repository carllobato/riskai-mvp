type PortfolioPageHeaderProps = {
  portfolioName: string;
};

/**
 * Page header for portfolio routes. Displays the portfolio name.
 */
export function PortfolioPageHeader({ portfolioName }: PortfolioPageHeaderProps) {
  return (
    <header className="border-b border-neutral-200 dark:border-neutral-700 bg-[var(--background)] px-4 sm:px-6 py-4">
      <h1 className="text-xl font-semibold text-[var(--foreground)] truncate">
        {portfolioName}
      </h1>
    </header>
  );
}
