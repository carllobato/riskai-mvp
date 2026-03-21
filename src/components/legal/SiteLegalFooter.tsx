import { LegalDocumentLink } from "./LegalDocumentLink";

const linkClass =
  "text-neutral-600 transition-colors hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-100";

export function SiteLegalFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="shrink-0 border-t border-neutral-200 bg-white/90 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950/90">
      <div className="mx-auto max-w-[1800px]">
        <div className="flex flex-col items-start justify-between gap-2 text-xs text-neutral-500 sm:flex-row sm:items-center">
          <span className="font-medium text-neutral-600 dark:text-neutral-400 sm:text-left">
            © {year} Visualify. All rights reserved.
          </span>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1">
            <LegalDocumentLink document="privacy" className={linkClass}>
              Privacy Policy
            </LegalDocumentLink>
            <LegalDocumentLink document="terms" className={linkClass}>
              Terms &amp; Conditions
            </LegalDocumentLink>
          </nav>
        </div>
      </div>
    </footer>
  );
}
