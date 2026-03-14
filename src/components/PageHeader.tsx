type PageHeaderProps = {
  projectName: string;
  portfolioName?: string | null;
};

/**
 * Page header for project routes. Shows "Portfolio Name - Project Name" when the project
 * is linked to a portfolio, otherwise just "Project Name".
 */
export function PageHeader({ projectName, portfolioName }: PageHeaderProps) {
  const title = portfolioName
    ? `${portfolioName} – ${projectName}`
    : projectName;

  return (
    <header className="border-b border-neutral-200 dark:border-neutral-700 bg-[var(--background)] px-4 sm:px-6 py-4">
      <h1 className="text-xl font-semibold text-[var(--foreground)] truncate">
        {title}
      </h1>
    </header>
  );
}
