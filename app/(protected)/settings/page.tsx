import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";
import { AccountProfileForm } from "./AccountProfileForm";

/** User settings: authenticated users only (enforced by (protected) layout). */
export default async function UserSettingsPage() {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=" + encodeURIComponent("/settings"));
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-1">
        Account settings
      </h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-8">
        Your account details.
      </p>

      <section className="mb-10">
        <h2 className="text-lg font-medium text-[var(--foreground)] mb-3">
          Profile
        </h2>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 p-4 space-y-4">
          <AccountProfileForm
            initialFirstName={(user.user_metadata as Record<string, unknown> | undefined)?.first_name as string | undefined}
            initialLastName={(user.user_metadata as Record<string, unknown> | undefined)?.last_name as string | undefined}
            initialCompany={(user.user_metadata as Record<string, unknown> | undefined)?.company as string | undefined}
          />
        </div>
        <dl className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 p-4 space-y-2 text-sm mt-4">
          <div>
            <dt className="text-neutral-500 dark:text-neutral-400">Email</dt>
            <dd className="font-medium text-[var(--foreground)]">
              {user.email ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500 dark:text-neutral-400">User ID</dt>
            <dd className="font-mono text-xs text-[var(--foreground)] break-all">
              {user.id}
            </dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-wrap gap-3">
        <SignOutButton />
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
