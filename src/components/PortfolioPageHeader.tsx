type PortfolioPageHeaderProps = {
  portfolioName: string;
};

/**
 * Page header for portfolio routes. Displays the portfolio name.
 */
export function PortfolioPageHeader({ portfolioName }: PortfolioPageHeaderProps) {
  return (
    <header className="h-[61px] flex items-center border-b border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-4 sm:px-6 shrink-0">
      <h1 className="text-xl font-semibold text-[var(--foreground)] truncate m-0">
        {portfolioName}
      </h1>
    </header>
  );
}
