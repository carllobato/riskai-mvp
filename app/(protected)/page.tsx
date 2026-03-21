import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessiblePortfolios, getAccessibleProjects } from "@/lib/portfolios-server";
import { supabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProjectRow = { id: string; name: string; created_at: string | null };

export default async function HomePage() {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=" + encodeURIComponent("/"));
  }

  const portfoliosResult = await getAccessiblePortfolios(supabase, user.id);
  const portfolios = portfoliosResult.ok ? portfoliosResult.portfolios : [];
  const portfolioIds = portfolios.map((p) => p.id);

  const projectsResult = await getAccessibleProjects(supabase, user.id, portfolioIds);
  const projects: ProjectRow[] = projectsResult.ok
    ? projectsResult.projects
    : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="mb-2 text-2xl font-semibold text-[var(--foreground)]">Dashboard</h1>
      <p className="mb-8 text-sm text-neutral-600 dark:text-neutral-400">
        Portfolios and projects you have access to.
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium text-[var(--foreground)]">Portfolios</h2>
        {portfolios.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-6 text-center dark:border-neutral-700 dark:bg-neutral-800/30">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              You don&apos;t have access to any portfolios yet.
            </p>
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
            <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">You don&apos;t have any projects yet.</p>
            <Link
              href="/create-project"
              className="inline-flex rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 no-underline hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
            >
              Create your first project
            </Link>
          </div>
        ) : (
          <>
            <ul className="mb-4 space-y-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="block rounded-md border border-neutral-200 bg-[var(--background)] px-4 py-3 text-[var(--foreground)] transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    <span className="font-medium">{p.name || p.id}</span>
                    <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">Open project →</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/create-project"
              className="inline-flex rounded-md border border-neutral-300 bg-[var(--background)] px-4 py-2 text-sm font-medium text-neutral-700 no-underline hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              + New project
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
