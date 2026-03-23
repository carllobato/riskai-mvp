import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterPageHeaderTitle } from "@/components/RegisterPageHeaderTitle";
import { supabaseServerClient } from "@/lib/supabase/server";
import { riskaiPath } from "@/lib/routes";

type ProjectRow = { id: string; name: string; created_at: string | null };

/** Portfolio and project list access are enforced by Supabase RLS (owner or portfolio_members). */
export default async function PortfolioProjectsPage({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const supabase = await supabaseServerClient();

  const { data: portfolio, error: portfolioError } = await supabase
    .from("portfolios")
    .select("id, name")
    .eq("id", portfolioId)
    .single();

  if (portfolioError || !portfolio) {
    redirect(riskaiPath("/not-found"));
  }

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .eq("portfolio_id", portfolioId)
    .order("created_at", { ascending: true });

  const list: ProjectRow[] = projectsError ? [] : (projects ?? []);

  return (
    <>
      <RegisterPageHeaderTitle titleSuffix="Projects" />
      <main className="w-full px-4 py-10">
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-8">
          Projects in this portfolio.
        </p>

        {list.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 p-6 text-center">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              No projects in this portfolio yet.
            </p>
            <Link
              href={riskaiPath("/projects")}
              className="text-sm text-[var(--foreground)] underline hover:no-underline"
            >
              View all your projects
            </Link>
          </div>
        ) : (
          <ul className="space-y-2 mb-6">
            {list.map((p) => (
              <li key={p.id}>
                <Link
                  href={riskaiPath(`/projects/${p.id}`)}
                  className="block px-4 py-3 rounded-md border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] text-[var(--foreground)] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  <span className="font-medium">{p.name || p.id}</span>
                  <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
                    Open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
