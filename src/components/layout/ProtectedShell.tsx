"use client";

import { useState } from "react";
import { SiteLegalFooter } from "@/components/legal/SiteLegalFooter";
import { TopNav } from "./TopNav";
import { Sidebar } from "./Sidebar";

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <TopNav
        onMenuClick={() => setMobileNavOpen(true)}
        onAccountMenuOpen={() => setMobileNavOpen(false)}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          <SiteLegalFooter />
        </div>
      </div>
    </div>
  );
}
