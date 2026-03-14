import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessiblePortfolios } from "@/lib/portfolios-server";
import { supabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=" + encodeURIComponent("/"));
  }

  const result = await getAccessiblePortfolios(supabase, user.id);

  if (!result.ok) {
    redirect("/portfolios");
  }

  const list = result.portfolios;

  if (list.length === 0) {
    return (
      <main className="min-h-[40vh] flex flex-col items-center justify-center px-4">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-2">
          No portfolios yet
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 text-center">
          You don&apos;t currently belong to any portfolios.
        </p>
        <Link
          href="#"
          className="text-sm px-4 py-2 rounded-md border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] text-[var(--foreground)] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          Create Portfolio
        </Link>
      </main>
    );
  }

  if (list.length === 1) {
    redirect(`/portfolios/${list[0].id}/projects`);
  }

  redirect("/portfolios");
}
