import { SummaryTile } from "@/components/dashboard/SummaryTile";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { RankedRiskList } from "@/components/dashboard/RankedRiskList";
import {
  MOCK_PORTFOLIO_SUMMARY,
  type PortfolioSummary,
} from "./mockPortfolioOverviewData";
import { formatPortfolioCurrency } from "./formatPortfolioCurrency";

function formatCoverageRatio(ratio: number): string {
  return `${ratio.toFixed(2)}x`;
}

/**
 * Portfolio Overview: executive snapshot of portfolio risk exposure.
 * Uses mock data only; ready to be wired to live data later.
 */
export function PortfolioOverviewContent() {
  const data: PortfolioSummary = MOCK_PORTFOLIO_SUMMARY;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Section A — Portfolio KPI Summary */}
      <section className="mb-8" aria-labelledby="portfolio-kpi-heading">
        <h2 id="portfolio-kpi-heading" className="sr-only">
          Portfolio KPI summary
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <SummaryTile
            title="Projects"
            primaryValue={String(data.projectCount)}
            subtext={`${data.activeProjectCount} active projects`}
          />
          <SummaryTile
            title="Active Risks"
            primaryValue={String(data.activeRisks)}
            subtext={`${data.highRisks} high severity`}
          />
          <SummaryTile
            title="Contingency Held"
            primaryValue={formatPortfolioCurrency(data.contingencyHeld)}
            subtext="Portfolio contingency pool"
          />
          <SummaryTile
            title="Risk Exposure"
            primaryValue={formatPortfolioCurrency(data.riskExposure)}
            subtext="Aggregated across projects"
          />
          <SummaryTile
            title="Coverage Ratio"
            primaryValue={formatCoverageRatio(data.coverageRatio)}
            subtext="Portfolio protection level"
          />
        </div>
      </section>

      {/* Section B — Portfolio Risk Concentration */}
      <section className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6" aria-labelledby="risk-concentration-heading">
        <h2 id="risk-concentration-heading" className="sr-only">
          Portfolio risk concentration
        </h2>
        <DashboardCard title="Top 5 Cost Risks">
          <RankedRiskList<Omit<PortfolioSummary["topCostRisks"][number], "id">>
            items={data.topCostRisks}
            renderRow={(item) => (
              <div className="flex-1 min-w-0 flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)] truncate m-0">
                    {item.title}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 m-0">
                    {item.projectName}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {formatPortfolioCurrency(item.value)}
                  </span>
                  {item.status != null && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-300">
                      {item.status}
                    </span>
                  )}
                </div>
              </div>
            )}
          />
        </DashboardCard>
        <DashboardCard title="Top 5 Schedule Risks">
          <RankedRiskList<Omit<PortfolioSummary["topScheduleRisks"][number], "id">>
            items={data.topScheduleRisks}
            renderRow={(item) => (
              <div className="flex-1 min-w-0 flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)] truncate m-0">
                    {item.title}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 m-0">
                    {item.projectName}
                  </p>
                </div>
                <span className="text-sm font-medium text-[var(--foreground)] shrink-0">
                  {item.impactDays} days
                </span>
              </div>
            )}
          />
        </DashboardCard>
      </section>

      {/* Section C — Portfolio Distribution (Placeholder) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6" aria-labelledby="distribution-placeholder-heading">
        <h2 id="distribution-placeholder-heading" className="sr-only">
          Portfolio distribution (placeholder)
        </h2>
        <DashboardCard title="Risk Exposure by Project">
          <p className="text-sm text-neutral-500 dark:text-neutral-400 m-0">
            Chart placeholder. Risk exposure by project will be displayed here.
          </p>
        </DashboardCard>
        <DashboardCard title="Risks by Category">
          <p className="text-sm text-neutral-500 dark:text-neutral-400 m-0">
            Chart placeholder. Risk breakdown by category will be displayed here.
          </p>
        </DashboardCard>
      </section>
    </main>
  );
}
