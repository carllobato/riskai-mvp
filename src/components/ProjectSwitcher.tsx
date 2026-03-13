"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchProjectsClient, type ProjectRow } from "@/lib/projects";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

const ACTIVE_PROJECT_KEY = "activeProjectId";
const SUBPAGES = ["setup", "risks", "outputs", "simulation"] as const;
type Subpage = (typeof SUBPAGES)[number];

function parseProjectRoute(pathname: string): { projectId: string; subpage: Subpage } | null {
  if (typeof pathname !== "string") return null;
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "projects" || !segments[1]) return null;
  const projectId = segments[1];
  const third = segments[2];
  const subpage: Subpage = third && SUBPAGES.includes(third as Subpage) ? (third as Subpage) : "risks";
  return { projectId, subpage };
}

const ChevronDown = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

type ProjectSwitcherProps = { currentProjectId?: string | null };

export function ProjectSwitcher({ currentProjectId: currentProjectIdFromUrl }: ProjectSwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectError, setNewProjectError] = useState<string | null>(null);
  const [newProjectLoading, setNewProjectLoading] = useState(false);
  const [activeFromStorage, setActiveFromStorage] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const routeInfo = parseProjectRoute(pathname ?? "");
  const subpage = routeInfo?.subpage ?? "risks";
  const currentProjectId =
    currentProjectIdFromUrl ?? activeFromStorage ?? (projects?.length ? projects[0].id : null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    const result = await fetchProjectsClient();
    setLoading(false);
    if (result.ok) setProjects(result.projects);
    else setProjects([]);
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Refetch projects when URL project id changes (e.g. after creating a project or switching) so switcher stays in sync.
  useEffect(() => {
    if (routeInfo?.projectId) loadProjects();
  }, [routeInfo?.projectId, loadProjects]);
  useEffect(() => {
    try {
      setActiveFromStorage(typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_PROJECT_KEY) : null);
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    if (!dropdownOpen && !modalOpen) return;
    try {
      setActiveFromStorage(typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_PROJECT_KEY) : null);
    } catch {
      // ignore
    }
  }, [dropdownOpen, modalOpen]);
  useEffect(() => {
    if (!dropdownOpen) return;
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, [dropdownOpen]);

  const currentProject = projects?.find((p) => p.id === currentProjectId);
  const displayName = currentProject?.name ?? "Project";
  const showDropdown = (projects?.length ?? 0) >= 1;
  const targetSubpage = currentProjectIdFromUrl && routeInfo ? routeInfo.subpage : "risks";

  const selectProject = useCallback(
    (projectId: string) => {
      try {
        window.localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
      } catch {
        // ignore
      }
      setActiveFromStorage(projectId);
      setDropdownOpen(false);
      router.replace(`/projects/${projectId}/${targetSubpage}`);
    },
    [targetSubpage, router]
  );

  const handleCreateProject = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setNewProjectError(null);
      const name = newProjectName.trim();
      if (!name) {
        setNewProjectError("Name is required.");
        return;
      }
      setNewProjectLoading(true);
      const supabase = supabaseBrowserClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        setNewProjectError("Not signed in.");
        setNewProjectLoading(false);
        return;
      }
      const { data: inserted, error } = await supabase
        .from("projects")
        .insert({ owner_id: user.id, name })
        .select("id")
        .single();

      if (error) {
        setNewProjectError(error.message);
        setNewProjectLoading(false);
        return;
      }
      const newId = (inserted as { id: string } | null)?.id;
      if (!newId) {
        setNewProjectError("Project created but could not get id.");
        setNewProjectLoading(false);
        return;
      }
      try {
        window.localStorage.setItem(ACTIVE_PROJECT_KEY, newId);
      } catch {
        // ignore
      }
      setModalOpen(false);
      setNewProjectName("");
      setNewProjectLoading(false);
      await loadProjects();
      router.replace(`/projects/${newId}/risks`);
    },
    [newProjectName, loadProjects, router]
  );

  if (loading) {
    return (
      <div className="h-8 w-32 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 animate-pulse" aria-hidden />
    );
  }

  if (!projects?.length) return null;

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => showDropdown && setDropdownOpen((o) => !o)}
        aria-expanded={dropdownOpen}
        aria-haspopup="listbox"
        aria-label="Switch project"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors truncate max-w-[220px]"
      >
        <span className="truncate">Project: {displayName}</span>
        {showDropdown && <ChevronDown />}
      </button>

      {dropdownOpen && (
        <ul
          role="listbox"
          className="absolute right-0 top-full mt-1 min-w-[200px] max-h-64 overflow-auto rounded-md border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] shadow-lg py-1 z-50"
        >
          {projects.map((p) => (
            <li key={p.id} role="option" aria-selected={p.id === currentProjectId}>
              <button
                type="button"
                onClick={() => selectProject(p.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {p.id === currentProjectId ? (
                  <span className="text-emerald-600 dark:text-emerald-400" aria-hidden>
                    <CheckIcon />
                  </span>
                ) : (
                  <span className="w-[14px]" aria-hidden />
                )}
                <span className="truncate">{p.name || p.id}</span>
              </button>
            </li>
          ))}
          <li className="border-t border-neutral-200 dark:border-neutral-700 mt-1 pt-1">
            <button
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                setModalOpen(true);
                setNewProjectError(null);
                setNewProjectName("");
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-[var(--foreground)]"
            >
              <span className="w-[14px]" aria-hidden />
              + New project
            </button>
          </li>
        </ul>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-project-title"
        >
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-[var(--background)] p-4 w-full max-w-sm shadow-lg">
            <h2 id="new-project-title" className="text-base font-semibold text-[var(--foreground)] mb-3">
              New project
            </h2>
            <form onSubmit={handleCreateProject} className="space-y-3">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name"
                className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-[var(--foreground)] text-sm"
                required
                disabled={newProjectLoading}
                autoFocus
              />
              {newProjectError && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {newProjectError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setNewProjectError(null);
                  }}
                  className="px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-600 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newProjectLoading}
                  className="px-3 py-1.5 rounded bg-[var(--foreground)] text-[var(--background)] text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {newProjectLoading ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
