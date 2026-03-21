"use client";

import { useRef, useState } from "react";
import { OnboardingHost } from "@/components/onboarding/OnboardingHost";
import { SiteLegalFooter } from "@/components/legal/SiteLegalFooter";
import { TopNav } from "./TopNav";
import { PageTransition } from "./PageTransition";
import { Sidebar } from "./Sidebar";

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <OnboardingHost />
      <TopNav
        onMenuClick={() => setMobileNavOpen(true)}
        onAccountMenuOpen={() => setMobileNavOpen(false)}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div ref={mainScrollRef} className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <PageTransition scrollContainerRef={mainScrollRef}>{children}</PageTransition>
          </div>
          <SiteLegalFooter />
        </div>
      </div>
    </div>
  );
}
