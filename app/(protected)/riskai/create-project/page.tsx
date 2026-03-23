"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { riskaiPath } from "@/lib/routes";

const ACTIVE_PROJECT_KEY = "activeProjectId";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PortfolioRow = { id: string; name: string };

function CreateProjectForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramPortfolioId = searchParams.get("portfolioId");

  const [name, setName] = useState("");
  const [portfolios, setPortfolios] = useState<PortfolioRow[] | null>(null);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/portfolios");
        const json = (await res.json()) as { portfolios?: PortfolioRow[]; error?: string };
        if (!res.ok) {
          if (!cancelled) setLoadError(json.error ?? "Could not load portfolios.");
          return;
        }
        const list = json.portfolios ?? [];
        if (!cancelled && list.length === 0) {
          if (!cancelled) setLoadError("Create a portfolio first (from the dashboard or onboarding).");
          return;
        }
        if (cancelled) return;
        setPortfolios(list);
        const fromQuery =
          paramPortfolioId && UUID_REGEX.test(paramPortfolioId) ? paramPortfolioId : null;
        const validFromQuery = fromQuery && list.some((p) => p.id === fromQuery) ? fromQuery : null;
        setSelectedPortfolioId(validFromQuery ?? list[0]!.id);
      } catch {
        if (!cancelled) setLoadError("Could not load portfolios.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paramPortfolioId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!selectedPortfolioId) {
      setMessage({ type: "error", text: "Select a portfolio." });
      return;
    }
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
      .insert({
        owner_user_id: user.id,
        name,
        portfolio_id: selectedPortfolioId,
      })
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
      router.replace(riskaiPath(`/projects/${projectId}`));
      router.refresh();
      return;
    }
    setMessage({ type: "error", text: "Project created but could not redirect." });
    setLoading(false);
  };

  if (loadError) {
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {loadError}
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-neutral-600 underline dark:text-neutral-400">
          Back to dashboard
        </Link>
      </main>
    );
  }

  if (portfolios === null) {
    return (
      <main className="mx-auto flex min-h-[30vh] max-w-md flex-col items-center justify-center px-4">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
      </main>
    );
  }

  const selectClass =
    "w-full rounded border border-neutral-300 bg-[var(--background)] px-3 py-2 text-sm text-neutral-900 dark:border-neutral-600 dark:text-neutral-100";

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-2 text-xl font-semibold text-[var(--foreground)]">Create project</h1>
      <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
        Projects are stored under a portfolio. You can move or add more portfolios later from the app.
      </p>
      <form onSubmit={handleCreate} className="space-y-3">
        {portfolios.length > 1 ? (
          <div>
            <label htmlFor="create-project-portfolio" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Portfolio
            </label>
            <select
              id="create-project-portfolio"
              value={selectedPortfolioId}
              onChange={(e) => setSelectedPortfolioId(e.target.value)}
              className={selectClass}
              disabled={loading}
              required
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || p.id}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Portfolio: <span className="font-medium text-[var(--foreground)]">{portfolios[0]?.name}</span>
          </p>
        )}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          className="w-full rounded border border-neutral-300 bg-[var(--background)] px-3 py-2 text-neutral-900 dark:border-neutral-600 dark:text-neutral-100"
          required
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded border border-neutral-300 bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:opacity-90 disabled:opacity-50 dark:border-neutral-600"
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
          ← Back to dashboard
        </Link>
      </p>
    </main>
  );
}

export default function CreateProjectPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[30vh] max-w-md flex-col items-center justify-center px-4">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
        </main>
      }
    >
      <CreateProjectForm />
    </Suspense>
  );
}
