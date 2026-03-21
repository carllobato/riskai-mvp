"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { useTheme } from "@/context/ThemeContext";
import type { User } from "@supabase/supabase-js";

const PersonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none shrink-0" aria-hidden>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none" aria-hidden>
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </svg>
);

const ChevronIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none opacity-60" aria-hidden>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none" aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none" aria-hidden>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

type TopNavProps = {
  onMenuClick?: () => void;
  /** When the account dropdown opens, parent can hide other chrome (e.g. mobile sidebar). */
  onAccountMenuOpen?: () => void;
  /** Translucent bar for full-bleed backgrounds (e.g. login). */
  variant?: "default" | "glass";
};

export function TopNav({ onMenuClick, onAccountMenuOpen, variant = "default" }: TopNavProps) {
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<User | null | "loading">("loading");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const supabase = supabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await supabaseBrowserClient().auth.signOut();
    window.location.href = "/login";
  };

  const headerSurface =
    variant === "glass"
      ? "border-b border-white/25 bg-white/70 transition-[background-color,border-color] duration-[250ms] ease-in-out dark:border-neutral-700/50 dark:bg-neutral-950/70"
      : "border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950";

  /** Glass: light bar uses a dark wash on hover; dark bar uses a light wash (same idea, theme-appropriate). */
  const iconButtonSurface =
    variant === "glass"
      ? "cursor-pointer text-neutral-700 hover:bg-black/[0.08] active:bg-black/[0.14] dark:text-neutral-200 dark:hover:bg-white/[0.16] dark:active:bg-white/[0.26]"
      : "cursor-pointer text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200/90 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:active:bg-neutral-700";

  return (
    <header className={`flex h-14 shrink-0 items-center justify-between px-4 ${headerSurface}`}>
      <div className="flex min-w-0 items-center gap-3">
        {onMenuClick ? (
          <button
            type="button"
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg md:hidden ${iconButtonSurface}`}
            aria-label="Open navigation"
            onClick={() => {
              setMenuOpen(false);
              onMenuClick();
            }}
          >
            <MenuIcon />
          </button>
        ) : null}
        <Link
          href="/"
          className="cursor-pointer text-lg font-semibold tracking-tight text-neutral-900 no-underline hover:opacity-80 dark:text-neutral-100"
        >
          RiskAI
        </Link>
      </div>

      <div className="flex items-center gap-2">
        {mounted ? (
          <button
            type="button"
            role="switch"
            aria-checked={theme === "dark"}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            onClick={(e) => {
              toggleTheme();
              (e.currentTarget as HTMLButtonElement).blur();
            }}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${iconButtonSurface}`}
          >
            {theme === "dark" ? <MoonIcon /> : <SunIcon />}
          </button>
        ) : (
          <span className="inline-block h-9 w-9 shrink-0 rounded-lg bg-neutral-100 dark:bg-neutral-800" aria-hidden />
        )}

        {user !== null && user !== "loading" ? (
          <div className="relative flex items-center" ref={menuRef}>
            <button
              type="button"
              onClick={() =>
                setMenuOpen((o) => {
                  const next = !o;
                  if (next) onAccountMenuOpen?.();
                  return next;
                })
              }
              className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 pl-1 pr-2 text-left text-sm text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100">
                <PersonIcon />
              </span>
              <ChevronIcon />
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-[100] mt-1 min-w-[200px] overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
              >
                <Link
                  href="/settings"
                  role="menuitem"
                  className="block cursor-pointer px-4 py-2.5 text-sm text-neutral-800 no-underline hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  onClick={() => setMenuOpen(false)}
                >
                  Account Settings
                </Link>
                <div
                  className="my-1 border-t border-neutral-200 dark:border-neutral-700"
                  role="separator"
                  aria-hidden
                />
                <button
                  type="button"
                  role="menuitem"
                  className="w-full cursor-pointer px-4 py-2.5 text-left text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        ) : user === "loading" ? (
          <span className="inline-block h-9 w-9 shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-700" aria-hidden />
        ) : null}
      </div>
    </header>
  );
}
