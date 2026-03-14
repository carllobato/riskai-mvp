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
    <header className="h-[61px] flex items-center border-b border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-4 sm:px-6 shrink-0">
      <h1 className="text-xl font-semibold text-[var(--foreground)] truncate m-0">
        {title}
      </h1>
    </header>
  );
}
