import Link from "next/link";
import type { ProjectTilePayload } from "@/lib/dashboard/projectTileServerData";

function ragDotClass(status: ProjectTilePayload["ragStatus"]): string {
  switch (status) {
    case "green":
      return "bg-emerald-500 dark:bg-emerald-400";
    case "amber":
      return "bg-amber-500 dark:bg-amber-400";
    case "red":
      return "bg-red-500 dark:bg-red-400";
    default:
      return "bg-neutral-400 dark:bg-neutral-500";
  }
}

/** Screen-reader only — matches dot semantics (no visible labels). */
function ragAriaFragment(status: ProjectTilePayload["ragStatus"]): string {
  switch (status) {
    case "green":
      return "Healthy.";
    case "amber":
      return "Watch.";
    case "red":
      return "At risk.";
    default:
      return "";
  }
}

function RagDot({ status }: { status: ProjectTilePayload["ragStatus"] }) {
  return (
    <span
      className={`size-2 shrink-0 rounded-full ${ragDotClass(status)}`}
      aria-hidden
    />
  );
}

/** Shared shell for dashboard project row tiles (project + new-project). Fixed height so rows align. */
export const PROJECT_TILE_LINK_CLASSES =
  "group flex h-14 items-center justify-between gap-3 self-start rounded-lg border border-neutral-200/55 bg-[var(--background)] px-[1.125rem] shadow-[0_1px_2px_rgba(0,0,0,0.03)] outline-none transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-px hover:border-neutral-200/80 hover:shadow-[0_3px_12px_rgba(0,0,0,0.055)] dark:border-neutral-700/50 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)] dark:hover:border-neutral-700/75 dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.28)] focus-visible:ring-2 focus-visible:ring-neutral-400/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

export type ProjectTileProps = {
  payload: ProjectTilePayload;
};

/** Distinct from project rows: dashed frame, tinted fill, emerald hover. */
const NEW_PROJECT_TILE_EXTRA_CLASSES =
  "border-dashed border-neutral-300/70 bg-neutral-50/60 hover:border-emerald-400/45 hover:bg-emerald-50/35 dark:border-neutral-600/70 dark:bg-neutral-800/40 dark:hover:border-emerald-500/35 dark:hover:bg-emerald-950/25";

export type NewProjectTileProps = {
  /** Default portfolio for `/create-project` when the user has several. */
  portfolioId?: string | null;
};

/**
 * Create-project tile: dashed card; + aligned right like the RAG dot on project rows.
 */
export function NewProjectTile({ portfolioId = null }: NewProjectTileProps) {
  const href =
    portfolioId != null && portfolioId !== ""
      ? `/create-project?portfolioId=${encodeURIComponent(portfolioId)}`
      : "/create-project";

  return (
    <Link
      href={href}
      className={`${PROJECT_TILE_LINK_CLASSES} ${NEW_PROJECT_TILE_EXTRA_CLASSES}`}
      aria-label="Create a new project"
    >
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-tight tracking-tight text-neutral-800 dark:text-neutral-100">
        New project
      </span>
      <span
        className="shrink-0 text-2xl font-light leading-none text-neutral-800 dark:text-neutral-100"
        aria-hidden
      >
        +
      </span>
    </Link>
  );
}

/**
 * Minimal dashboard tile: project name with right-aligned RAG dot.
 */
export function ProjectTile({ payload }: ProjectTileProps) {
  const { id, name, ragStatus } = payload;
  const title = name?.trim() || id;

  return (
    <Link
      href={`/projects/${id}`}
      className={PROJECT_TILE_LINK_CLASSES}
      aria-label={`Open project ${title}. ${ragAriaFragment(ragStatus)}`}
    >
      <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-tight tracking-tight text-[var(--foreground)]">
        {title}
      </h3>
      <RagDot status={ragStatus} />
    </Link>
  );
}
