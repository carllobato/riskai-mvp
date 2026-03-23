"use client";

import { useEffect } from "react";
import { useOptionalPageHeaderExtras } from "@/contexts/PageHeaderExtrasContext";

/**
 * Registers a `titleSuffix` for the current route’s shell header (portfolio or project layout).
 * No-op when no `PageHeaderExtrasProvider` is present.
 */
export function RegisterPageHeaderTitle({ titleSuffix }: { titleSuffix: string }) {
  const setExtras = useOptionalPageHeaderExtras()?.setExtras;
  useEffect(() => {
    if (!setExtras) return;
    setExtras({ titleSuffix, end: null });
    return () => setExtras(null);
  }, [setExtras, titleSuffix]);
  return null;
}
