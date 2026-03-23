import Link from "next/link";
import { supabaseServerClient } from "@/lib/supabase/server";
import DevLoginClient from "./DevLoginClient";
import DevSignOutClient from "./DevSignOutClient";

export default async function DevUserPage() {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return (
      <main className="p-6 max-w-2xl">
        <h1 className="text-xl font-semibold m-0 mb-4">Dev: User persistence</h1>
        <p className="text-red-700 dark:text-red-400 mb-4">
          Auth error: {userError.message}
        </p>
        <DevLoginClient />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="p-6 max-w-2xl">
        <h1 className="text-xl font-semibold m-0 mb-4">Dev: User persistence</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          Sign in to verify that <code className="text-sm bg-neutral-100 dark:bg-neutral-800 px-1 rounded">public.profiles</code> has a row (e.g. after saving account settings or migration copy from legacy <code className="text-xs">users</code>).
        </p>
        <DevLoginClient />
      </main>
    );
  }

  const { data: userRow, error: rowError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <main className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold m-0 mb-4">Dev: User persistence</h1>
      <div className="space-y-2 mb-4">
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          <strong>Auth user id:</strong> <code className="text-xs bg-neutral-100 dark:bg-neutral-800 px-1 rounded break-all">{user.id}</code>
        </p>
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          <strong>Email:</strong> {user.email ?? "—"}
        </p>
      </div>
      <div className="mb-4">
        {rowError ? (
          <p className="text-red-700 dark:text-red-400">
            ❌ profile row missing — {rowError.message}
          </p>
        ) : userRow ? (
          <p className="text-green-700 dark:text-green-400 font-medium">
            ✅ profile row exists
          </p>
        ) : (
          <p className="text-red-700 dark:text-red-400">❌ user row missing</p>
        )}
      </div>
      <p className="mb-2">
        <Link href="/riskai/dev/projects" className="text-blue-600 dark:text-blue-400 underline">
          Projects (dev)
        </Link>
      </p>
      <DevSignOutClient />
    </main>
  );
}
