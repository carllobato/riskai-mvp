"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ProjectPermissions } from "@/types/projectPermissions";

const ProjectPermissionsContext = createContext<ProjectPermissions | null>(null);

export function ProjectPermissionsProvider({
  permissions,
  children,
}: {
  permissions: ProjectPermissions;
  children: ReactNode;
}) {
  return (
    <ProjectPermissionsContext.Provider value={permissions}>
      {children}
    </ProjectPermissionsContext.Provider>
  );
}

/** Null outside /projects/[projectId] layout (e.g. legacy risk register). */
export function useProjectPermissions(): ProjectPermissions | null {
  return useContext(ProjectPermissionsContext);
}
