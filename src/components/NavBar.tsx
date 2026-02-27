"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems: { href: string; label: string }[] = [
  { href: "/risk-register", label: "Risk Register" },
  { href: "/matrix", label: "Risk Matrix" },
  { href: "/outputs", label: "Outputs" },
  { href: "/day0", label: "Day 0" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 flex items-center gap-6 px-6 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-[var(--background)] shadow-sm">
      {/* Left: app name / logo */}
      <Link
        href="/risk-register"
        className="text-lg font-semibold text-[var(--foreground)] no-underline shrink-0 hover:opacity-80 transition-opacity"
      >
        RiskAI
      </Link>

      {/* Center/left: main nav links */}
      <div className="flex items-center gap-1">
        {navItems.map(({ href, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`
                px-3 py-2 rounded-md text-sm font-medium no-underline transition-colors
                ${isActive
                  ? "bg-neutral-200 dark:bg-neutral-700 text-[var(--foreground)] underline underline-offset-4"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-[var(--foreground)] hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }
              `}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Right: reserved for theme toggle (no implementation in this step) */}
      <div className="ml-auto w-10 shrink-0" aria-hidden />
    </nav>
  );
}
