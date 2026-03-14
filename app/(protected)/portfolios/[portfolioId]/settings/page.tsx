import Link from "next/link";
import { supabaseServerClient } from "@/lib/supabase/server";
import {
  assertPortfolioAdminAccess,
  type PortfolioMemberRow,
} from "@/lib/portfolios-server";
import { NotFoundContent } from "../../../../not-found-content";

/** Portfolio settings: only owner or member with role 'admin' can access. */
export default async function PortfolioSettingsPage({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <NotFoundContent />;
  }

  const result = await assertPortfolioAdminAccess(
    portfolioId,
    supabase,
    user.id
  );

  if ("error" in result) {
    return <NotFoundContent />;
  }

  const { portfolio } = result;

  const { data: members, error: membersError } = await supabase
    .from("portfolio_members")
    .select("id, portfolio_id, user_id, role, created_at")
    .eq("portfolio_id", portfolioId)
    .order("created_at", { ascending: true });

  const memberList: PortfolioMemberRow[] = membersError ? [] : (members ?? []);

  const formatDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      {(portfolio.description || true) && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-8">
          {portfolio.description ?? "Portfolio settings and members."}
        </p>
      )}

      {/* Portfolio settings summary */}
      <section className="mb-10">
        <h2 className="text-lg font-medium text-[var(--foreground)] mb-3">
          Settings
        </h2>
        <dl className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 p-4 space-y-2 text-sm">
          <div>
            <dt className="text-neutral-500 dark:text-neutral-400">Name</dt>
            <dd className="font-medium text-[var(--foreground)]">
              {portfolio.name}
            </dd>
          </div>
          {portfolio.description && (
            <div>
              <dt className="text-neutral-500 dark:text-neutral-400">
                Description
              </dt>
              <dd className="text-[var(--foreground)]">
                {portfolio.description}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-neutral-500 dark:text-neutral-400">Owner ID</dt>
            <dd className="font-mono text-xs text-[var(--foreground)] break-all">
              {portfolio.owner_id}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500 dark:text-neutral-400">Created</dt>
            <dd className="text-[var(--foreground)]">
              {formatDate(portfolio.created_at)}
            </dd>
          </div>
        </dl>
      </section>

      {/* 3. Members section */}
      <section className="mb-10">
        <h2 className="text-lg font-medium text-[var(--foreground)] mb-3">
          Members
        </h2>
        {memberList.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 p-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
            No members listed (owner is implicit).
          </div>
        ) : (
          <ul className="space-y-2">
            {memberList.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-4 px-4 py-3 rounded-md border border-neutral-200 dark:border-neutral-700 bg-[var(--background)]"
              >
                <span className="font-mono text-xs text-[var(--foreground)] break-all">
                  {m.user_id}
                </span>
                <span
                  className="shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-neutral-200 dark:bg-neutral-600 text-[var(--foreground)]"
                  title="Role"
                >
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4. Admin actions (placeholders) */}
      <section className="mb-10">
        <h2 className="text-lg font-medium text-[var(--foreground)] mb-3">
          Admin actions
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
          Future actions will appear here.
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
            <span className="font-medium text-[var(--foreground)]">
              Add member
            </span>
            <span className="text-xs">(placeholder)</span>
          </li>
          <li className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
            <span className="font-medium text-[var(--foreground)]">
              Change role
            </span>
            <span className="text-xs">(placeholder)</span>
          </li>
          <li className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
            <span className="font-medium text-[var(--foreground)]">
              Remove member
            </span>
            <span className="text-xs">(placeholder)</span>
          </li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/portfolios/${portfolioId}/projects`}
          className="inline-flex px-4 py-2 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
        >
          View projects
        </Link>
        <Link
          href="/portfolios"
          className="inline-flex px-4 py-2 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
        >
          ← Back to portfolios
        </Link>
      </div>
    </main>
  );
}
