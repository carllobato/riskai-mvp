"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import type { PortfolioRow } from "@/lib/portfolios";
import { fetchPortfoliosClient } from "@/lib/portfolios";

const PORTFOLIOS_PATH = "/portfolios";

export function PortfoliosPageClient() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [portfolios, setPortfolios] = useState<PortfolioRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const supabase = supabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;
      if (!session?.user) {
        router.replace("/login?next=" + encodeURIComponent(PORTFOLIOS_PATH));
        return;
      }

      const result = await fetchPortfoliosClient();
      if (cancelled) return;
      if (!result.ok) {
        setStatus("error");
        return;
      }
      setPortfolios(result.portfolios);
      setStatus("ready");
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === "loading") {
    return (
      <main className="min-h-[40vh] flex flex-col items-center justify-center px-4">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-[40vh] flex flex-col items-center justify-center px-4">
        <p className="text-sm text-red-600 dark:text-red-400">Failed to load portfolios.</p>
        <Link
          href={PORTFOLIOS_PATH}
          className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 underline hover:no-underline"
        >
          Try again
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-1">
        Portfolios
      </h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-8">
        Portfolios you can access. Open one to view its projects.
      </p>

      {portfolios.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 p-6 text-center">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            You don&apos;t have access to any portfolios yet.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {portfolios.map((p) => (
            <li key={p.id}>
              <Link
                href={`/portfolios/${p.id}/projects`}
                className="block px-4 py-3 rounded-md border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] text-[var(--foreground)] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <span className="font-medium">{p.name || p.id}</span>
                <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
                  View projects →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
