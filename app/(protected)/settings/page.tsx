import Link from "next/link";
import { redirect } from "next/navigation";
import { isDevAuthBypassEnabled } from "@/lib/dev/devAuthBypass";
import { fetchPublicProfile } from "@/lib/profiles/profileDb";
import { supabaseServerClient } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";
import { AccountProfileForm } from "./AccountProfileForm";
import { DeleteAccountSection } from "./DeleteAccountSection";

/** User settings: authenticated users only (enforced by (protected) layout). */
export default async function UserSettingsPage() {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isDevAuthBypassEnabled()) {
    redirect("/login?next=" + encodeURIComponent("/settings"));
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <span className="font-medium">Dev preview:</span> sign in to use profile, delete account, and sign out.
        </p>
        <h1 className="mb-1 text-2xl font-semibold text-[var(--foreground)]">Account settings</h1>
        <p className="mb-8 text-sm text-neutral-600 dark:text-neutral-400">Your account details.</p>
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-medium text-[var(--foreground)]">Profile</h2>
          <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800/30 dark:text-neutral-400">
            <p>Form hidden — no session.</p>
          </div>
        </section>
        <Link
          href="/portfolios"
          className="inline-flex rounded-md border border-neutral-300 bg-[var(--background)] px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          ← Back to portfolios
        </Link>
      </main>
    );
  }

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const profileRow = await fetchPublicProfile(supabase, user.id);

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
            initialFirstName={profileRow?.first_name ?? (meta?.first_name as string | undefined)}
            initialLastName={profileRow?.surname ?? (meta?.last_name as string | undefined)}
            initialCompany={profileRow?.company ?? (meta?.company as string | undefined)}
            initialRole={profileRow?.role ?? (meta?.role as string | undefined)}
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

      <DeleteAccountSection />

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
