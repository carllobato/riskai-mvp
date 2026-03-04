"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

const ACTIVE_PROJECT_KEY = "activeProjectId";

export default function CreateProjectPage() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    const supabase = supabaseBrowserClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setMessage({ type: "error", text: userError?.message ?? "Not signed in." });
      setLoading(false);
      return;
    }
    const { data: inserted, error } = await supabase
      .from("projects")
      .insert({ owner_id: user.id, name })
      .select("id")
      .single();

    if (error) {
      setMessage({ type: "error", text: error.message });
      setLoading(false);
      return;
    }
    const projectId = (inserted as { id: string } | null)?.id;
    if (projectId) {
      try {
        window.localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
      } catch {
        // ignore
      }
      router.replace(`/projects/${projectId}/risks`);
      return;
    }
    setMessage({ type: "error", text: "Project created but could not redirect." });
    setLoading(false);
  };

  return (
    <main className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-xl font-semibold text-[var(--foreground)] mb-2">
        Create your first project
      </h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
        Give your project a name to get started. You can configure details and add risks next.
      </p>
      <form onSubmit={handleCreate} className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-neutral-900 dark:text-neutral-100"
          required
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create project"}
        </button>
      </form>
      {message && (
        <p
          className={`mt-3 text-sm ${message.type === "success" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
          role="alert"
        >
          {message.text}
        </p>
      )}
      <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
        <Link href="/" className="underline hover:no-underline">
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
