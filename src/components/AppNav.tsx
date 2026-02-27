"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems: { href: string; label: string }[] = [
  { href: "/risk-register", label: "Risk Register" },
  { href: "/matrix", label: "Risk Matrix" },
  { href: "/outputs", label: "Outputs" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        display: "flex",
        gap: 16,
        padding: "12px 24px",
        borderBottom: "1px solid var(--foreground)",
        opacity: 0.9,
      }}
    >
      {navItems.map(({ href, label }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            style={{
              fontWeight: isActive ? 600 : 400,
              color: "var(--foreground)",
              textDecoration: isActive ? "underline" : "none",
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
