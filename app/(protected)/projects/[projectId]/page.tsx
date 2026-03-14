import Link from "next/link";
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
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Project Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-1">
          {project.name}
        </h1>
        <dl className="text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
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
      </header>

      {/* Quick Stats */}
      <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 p-4 mb-8">
        <h2 className="text-base font-semibold text-[var(--foreground)] mb-3">
          Quick Stats
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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
      </section>

      {/* Quick Navigation */}
      <section>
        <h2 className="text-base font-semibold text-[var(--foreground)] mb-3">
          Quick Navigation
        </h2>
        <nav className="flex flex-wrap gap-3">
          <Link
            href={`/projects/${projectId}/risks`}
            className="inline-flex items-center px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-[var(--foreground)] text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors no-underline"
          >
            Risk Register
          </Link>
          <Link
            href={`/projects/${projectId}/simulation`}
            className="inline-flex items-center px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-[var(--foreground)] text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors no-underline"
          >
            Simulation
          </Link>
          <Link
            href={`/projects/${projectId}/settings`}
            className="inline-flex items-center px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-[var(--foreground)] text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors no-underline"
          >
            Project Settings
          </Link>
        </nav>
      </section>
    </main>
  );
}
