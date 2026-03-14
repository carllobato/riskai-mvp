type DashboardCardProps = {
  title: string;
  children: React.ReactNode;
};

/**
 * Reusable container card for dashboard sections. Consistent padding, border, and background.
 */
export function DashboardCard({ title, children }: DashboardCardProps) {
  return (
    <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] overflow-hidden">
      <h2 className="text-base font-semibold text-[var(--foreground)] px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 m-0">
        {title}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  );
}
