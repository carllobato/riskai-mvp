import { notFound } from "next/navigation";
import { getProjectIfAccessible } from "@/lib/db/projectAccess";
import { supabaseServerClient } from "@/lib/supabase/server";

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProjectIfAccessible(projectId);
  if (!project) notFound();

  const supabase = await supabaseServerClient();

  const [
    { data: projectExtra },
    { count: riskCount },
    { data: latestSnapshot },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("portfolio_id, owner_id")
      .eq("id", projectId)
      .single(),
    supabase
      .from("risks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    supabase
      .from("simulation_snapshots")
      .select("created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let portfolioName: string | null = null;
  if (projectExtra?.portfolio_id) {
    const { data: portfolioRow } = await supabase
      .from("portfolios")
      .select("name")
      .eq("id", projectExtra.portfolio_id)
      .single();
    portfolioName = portfolioRow?.name ?? null;
  }
  const created_at = project.created_at;
  const latestSnapshotDate = latestSnapshot?.created_at ?? null;

  const formatDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";

  return (
    <main className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] m-0 mb-2">
          {project.name}
        </h2>
        <dl className="text-sm text-neutral-600 dark:text-neutral-400 space-y-1 m-0">
          {portfolioName && (
            <div>
              <dt className="inline font-medium text-neutral-700 dark:text-neutral-300">
                Portfolio:{" "}
              </dt>
              <dd className="inline">{portfolioName}</dd>
            </div>
          )}
          <div>
            <dt className="inline font-medium text-neutral-700 dark:text-neutral-300">
              Owner:{" "}
            </dt>
            <dd className="inline">—</dd>
          </div>
          <div>
            <dt className="inline font-medium text-neutral-700 dark:text-neutral-300">
              Created:{" "}
            </dt>
            <dd className="inline">{formatDate(created_at)}</dd>
          </div>
        </dl>
      </div>

      {/* Quick Stats */}
      <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 overflow-hidden mt-0">
        <h2 className="text-base font-semibold text-[var(--foreground)] px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 m-0">
          Quick Stats
        </h2>
        <div className="p-4">
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm m-0 list-none p-0">
          <li className="flex justify-between gap-2">
            <span className="text-neutral-600 dark:text-neutral-400">
              Risks
            </span>
            <span className="font-medium text-[var(--foreground)]">
              {riskCount ?? 0}
            </span>
          </li>
          <li className="flex justify-between gap-2">
            <span className="text-neutral-600 dark:text-neutral-400">
              Latest simulation
            </span>
            <span className="font-medium text-[var(--foreground)]">
              {formatDate(latestSnapshotDate)}
            </span>
          </li>
        </ul>
        </div>
      </section>
    </main>
  );
}
