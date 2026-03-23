/**
 * Shared 404 UI. Used by app/not-found.tsx and the catch-all route so the
 * same content is shown whether notFound() is called or an invalid URL is hit.
 * Plain <a> links so navigation away does a full page load and layout remounts.
 */
export function NotFoundContent() {
  return (
    <main className="min-h-[40vh] flex flex-col items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200">
          404 – Page not found
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          The page you're looking for doesn't exist. Use the links below to
          reload the app.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <a
            href="/"
            className="px-4 py-2 text-sm font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 no-underline"
          >
            Home
          </a>
          <a
            href="/riskai/projects"
            className="px-4 py-2 text-sm font-medium rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 no-underline"
          >
            Projects
          </a>
        </div>
      </div>
    </main>
  );
}
