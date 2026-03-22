import Link from "next/link";
import { redirect } from "next/navigation";
import { GreetingHeader } from "@/components/GreetingHeader";
import { NewProjectTile, ProjectTile } from "@/components/dashboard/ProjectTile";
import {
  getProjectTilePayloads,
  sortProjectTilesByRag,
  type ProjectTilePayload,
} from "@/lib/dashboard/projectTileServerData";
import type { AccessiblePortfolio, AccessibleProject } from "@/lib/portfolios-server";
import { isDevAuthBypassEnabled } from "@/lib/dev/devAuthBypass";
import { getAccessiblePortfolios, getAccessibleProjects } from "@/lib/portfolios-server";
import { fetchPublicProfile } from "@/lib/profiles/profileDb";
import { supabaseServerClient } from "@/lib/supabase/server";
import { dlog } from "@/lib/debug";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const devBypass = isDevAuthBypassEnabled();
  if (!user && !devBypass) {
    redirect("/login?next=" + encodeURIComponent("/"));
  }

  let portfolios: AccessiblePortfolio[] = [];
  let projects: AccessibleProject[] = [];
  let projectTiles: ProjectTilePayload[] = [];

  if (user) {
    const portfoliosResult = await getAccessiblePortfolios(supabase, user.id);
    portfolios = portfoliosResult.ok ? portfoliosResult.portfolios : [];
    const portfolioIds = portfolios.map((p) => p.id);
    const projectsResult = await getAccessibleProjects(supabase, user.id, portfolioIds);
    projects = projectsResult.ok ? projectsResult.projects : [];
    projectTiles = projectsResult.ok
      ? sortProjectTilesByRag(await getProjectTilePayloads(supabase, projects))
      : [];
    dlog("[dashboard] accessible projects", {
      count: projects.length,
      portfolioScopeCount: portfolioIds.length,
      source: "getAccessibleProjects (owner + project_members + portfolio)",
    });
  }

  const meta = user?.user_metadata as Record<string, unknown> | undefined;
  const profileRow = user ? await fetchPublicProfile(supabase, user.id) : null;
  const rawFirst = profileRow?.first_name ?? meta?.first_name;
  const dashboardFirstName =
    typeof rawFirst === "string" && rawFirst.trim() ? rawFirst.trim() : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {devBypass && !user ? (
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <span className="font-medium">Dev preview:</span> no Supabase session. Remove{" "}
          <code className="rounded bg-amber-100/80 px-1 font-mono text-xs dark:bg-amber-900/50">
            DEV_SKIP_AUTH_GUARD=1
          </code>{" "}
          from <code className="font-mono text-xs">.env.local</code> to test real sign-in. Project URLs still need a
          logged-in user (RLS).
        </p>
      ) : null}
      <GreetingHeader firstName={dashboardFirstName} />

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium text-[var(--foreground)]">Portfolios</h2>
        {portfolios.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-6 text-center dark:border-neutral-700 dark:bg-neutral-800/30">
            <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
              Create a portfolio to organise your projects. If you&apos;re seeing this by mistake, refresh the page.
            </p>
            <Link
              href="/onboarding/portfolio"
              className="inline-flex rounded-md border border-neutral-300 bg-[var(--background)] px-4 py-2 text-sm font-medium text-neutral-800 no-underline hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              Create portfolio
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {portfolios.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/portfolios/${p.id}`}
                  className="block rounded-md border border-neutral-200 bg-[var(--background)] px-4 py-3 text-[var(--foreground)] transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  <span className="font-medium">{p.name || p.id}</span>
                  <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">Open portfolio →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-[var(--foreground)]">Projects</h2>
        {projects.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-6 text-center dark:border-neutral-700 dark:bg-neutral-800/30">
            {portfolios.length === 0 ? (
              <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
                You don&apos;t have any projects yet. Create a portfolio first if you need to start your own workspace, or ask to be added to a project you collaborate on.
              </p>
            ) : (
              <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">You don&apos;t have any projects yet.</p>
            )}
            {portfolios.length > 0 ? (
              <Link
                href={
                  portfolios[0]?.id
                    ? `/create-project?portfolioId=${encodeURIComponent(portfolios[0].id)}`
                    : "/create-project"
                }
                className="inline-flex rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 no-underline hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
              >
                Create your first project
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projectTiles.map((payload) => (
              <ProjectTile key={payload.id} payload={payload} />
            ))}
            {portfolios.length > 0 ? (
              <NewProjectTile portfolioId={portfolios[0]?.id ?? null} />
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
