"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PortfolioRow = { id: string; name: string };

export default function CreateProjectClient() {
  const [name, setName] = useState("");
  const [portfolios, setPortfolios] = useState<PortfolioRow[] | null>(null);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

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
        if (cancelled) return;
        if (list.length === 0) {
          setLoadError("Create a portfolio first (from the dashboard or onboarding).");
          return;
        }
        setPortfolios(list);
        setSelectedPortfolioId(list[0]!.id);
      } catch {
        if (!cancelled) setLoadError("Could not load portfolios.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!selectedPortfolioId) {
      setMessage({ type: "error", text: "Select a portfolio." });
      return;
    }
    setLoading(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ name, portfolioId: selectedPortfolioId }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      project?: { id: string };
      error?: string;
    };
    if (!res.ok || !json.project) {
      setMessage({
        type: "error",
        text: json.error?.trim() || (res.status === 401 ? "Not signed in." : "Could not create project."),
      });
      setLoading(false);
      return;
    }
    setMessage({ type: "success", text: "Project created." });
    setName("");
    setLoading(false);
    router.refresh();
  };

  const selectClass =
    "w-full max-w-xs rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100";

  if (loadError) {
    return <p className="text-sm text-red-700 dark:text-red-400">{loadError}</p>;
  }

  if (portfolios === null) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading portfolios…</p>;
  }

  return (
    <form onSubmit={handleCreate} className="space-y-2">
      {portfolios.length > 1 ? (
        <div>
          <label htmlFor="dev-create-project-portfolio" className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Portfolio
          </label>
          <select
            id="dev-create-project-portfolio"
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
        <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs">
          Portfolio: <span className="font-medium text-[var(--foreground)]">{portfolios[0]?.name}</span>
        </p>
      )}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name"
        className="w-full max-w-xs px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-neutral-900 dark:text-neutral-100"
        required
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading}
        className="px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] hover:bg-neutral-100 dark:hover:bg-neutral-700 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create"}
      </button>
      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
