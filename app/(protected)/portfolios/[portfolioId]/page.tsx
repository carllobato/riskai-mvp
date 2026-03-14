import { supabaseServerClient } from "@/lib/supabase/server";
import { NotFoundContent } from "../../../not-found-content";

/**
 * Portfolio overview / dashboard. Placeholder for portfolio-wide risks (to be filled in later).
 */
export default async function PortfolioOverviewPage({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const supabase = await supabaseServerClient();

  const { data: portfolio, error: portfolioError } = await supabase
    .from("portfolios")
    .select("id, name, description, created_at")
    .eq("id", portfolioId)
    .single();

  if (portfolioError || !portfolio) {
    return <NotFoundContent />;
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {(portfolio.description || true) && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
          {portfolio.description ?? "Portfolio overview and risk dashboard."}
        </p>
      )}

      {/* Placeholder: Portfolio risks dashboard (to be filled later) */}
      <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 p-6">
        <h2 className="text-lg font-medium text-[var(--foreground)] mb-2">
          Portfolio risks
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          A dashboard of all risks across projects in this portfolio will appear here. Details to follow.
        </p>
      </section>
    </main>
  );
}
