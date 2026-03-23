"use client";

import { useEffect } from "react";

export function SetActiveProjectClient({
  projectId,
  storageKey,
}: {
  projectId: string;
  storageKey: string;
}) {
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && projectId) {
        window.localStorage.setItem(storageKey, projectId);
      }
    } catch {
      // ignore
    }
  }, [projectId, storageKey]);
  return null;
}
