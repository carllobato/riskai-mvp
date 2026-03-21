"use client";

import { useEffect, useState } from "react";

/** Local-time greeting buckets (05:00–11:59 morning, 12:00–17:59 afternoon, else evening). */
export function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

type GreetingHeaderProps = {
  /** Profile first name when known (e.g. from server session); falls back to “there”. */
  firstName?: string | null;
  className?: string;
};

export function GreetingHeader({ firstName, className }: GreetingHeaderProps) {
  const [greeting, setGreeting] = useState<string | null>(null);
  const displayName = firstName?.trim() ? firstName.trim() : "there";

  useEffect(() => {
    setGreeting(getGreeting(new Date().getHours()));
  }, []);

  const rootClass = className ? `mb-8 ${className}` : "mb-8";

  return (
    <header className={rootClass}>
      <div className="min-h-[2.5rem]">
        {greeting != null ? (
          <h1 className="text-2xl font-medium tracking-tight text-[var(--foreground)]">
            {greeting}, {displayName}
          </h1>
        ) : (
          <h1
            className="invisible text-2xl font-medium tracking-tight text-[var(--foreground)]"
            aria-hidden
          >
            Good afternoon, {displayName}
          </h1>
        )}
      </div>
      <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
        Here&apos;s your current workspace
      </p>
    </header>
  );
}
