import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessiblePortfolios } from "@/lib/portfolios-server";
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

  const [portfoliosResult, { data: projectsData }] = await Promise.all([
    getAccessiblePortfolios(supabase, user.id),
    supabase
      .from("projects")
      .select("id, name, created_at")
      .order("created_at", { ascending: true }),
  ]);

  const portfolios = portfoliosResult.ok ? portfoliosResult.portfolios : [];
  const projects: ProjectRow[] = (projectsData ?? []).map((p) => ({
    id: p.id,
    name: p.name ?? "",
    created_at: p.created_at ?? null,
  }));

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
        Home
      </h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-8">
        Portfolios and projects you have access to.
      </p>

      {/* Portfolios */}
      <section className="mb-10">
        <h2 className="text-lg font-medium text-[var(--foreground)] mb-3">
          Portfolios
        </h2>
        {portfolios.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 p-6 text-center">
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
                  className="block px-4 py-3 rounded-md border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] text-[var(--foreground)] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <span className="font-medium">{p.name || p.id}</span>
                  <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
                    Open portfolio →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Projects */}
      <section>
        <h2 className="text-lg font-medium text-[var(--foreground)] mb-3">
          Projects
        </h2>
        {projects.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 p-6 text-center">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              You don&apos;t have any projects yet.
            </p>
            <Link
              href="/create-project"
              className="inline-flex px-4 py-2 text-sm font-medium rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 no-underline"
            >
              Create your first project
            </Link>
          </div>
        ) : (
          <>
            <ul className="space-y-2 mb-4">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="block px-4 py-3 rounded-md border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] text-[var(--foreground)] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <span className="font-medium">{p.name || p.id}</span>
                    <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
                      Open project →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/create-project"
              className="inline-flex px-4 py-2 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 no-underline"
            >
              + New project
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
