import Link from "next/link";
import { supabaseServerClient } from "@/lib/supabase/server";
import CreateProjectClient from "./CreateProjectClient";

export default async function DevProjectsPage() {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return (
      <main className="p-6 max-w-2xl">
        <h1 className="text-xl font-semibold m-0 mb-4">Projects (dev)</h1>
        <p className="text-red-700 dark:text-red-400">Auth error: {userError.message}</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="p-6 max-w-2xl">
        <h1 className="text-xl font-semibold m-0 mb-4">Projects (dev)</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">Not signed in.</p>
        <Link href="/riskai/dev/user" className="text-blue-600 dark:text-blue-400 underline">
          Go to /dev/user
        </Link>
      </main>
    );
  }

  // RLS returns all projects the user can read (owner, project_members, portfolio).
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold m-0 mb-4">Projects (dev)</h1>
      <CreateProjectClient />
      {projectsError ? (
        <p className="text-red-700 dark:text-red-400 mt-4">Error loading projects: {projectsError.message}</p>
      ) : (
        <ul className="mt-4 list-disc list-inside space-y-1">
          {(projects ?? []).map((p) => (
            <li key={p.id}>
              <span className="font-medium">{p.name}</span> — id: <code className="text-xs bg-neutral-100 dark:bg-neutral-800 px-1 rounded">{p.id}</code>
              {" "}
              <span className="text-neutral-500 text-sm">
                {p.created_at ? new Date(p.created_at).toISOString() : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
