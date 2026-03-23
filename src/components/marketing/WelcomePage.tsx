import Link from "next/link";
import { APP_ORIGIN } from "@/lib/host";
import { DASHBOARD_PATH } from "@/lib/routes";

/** Public marketing home for the website host (visualify.com.au). */
export function WelcomePage() {
  const signInHref = `${APP_ORIGIN}/?next=${encodeURIComponent(DASHBOARD_PATH)}`;
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">Visualify RiskAI</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Model, analyse, and manage risk in one place. Sign in to open your portfolios and projects.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href={signInHref}
          className="inline-flex rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white no-underline hover:bg-neutral-800 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white"
        >
          Sign in
        </Link>
        <Link
          href="/privacy"
          className="inline-flex rounded-md border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-800 no-underline hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          Privacy
        </Link>
        <Link
          href="/terms"
          className="inline-flex rounded-md border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-800 no-underline hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          Terms
        </Link>
      </div>
    </main>
  );
}
