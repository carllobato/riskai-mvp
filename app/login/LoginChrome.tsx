import { TopNav } from "@/components/layout/TopNav";
import { LoginBackgroundPreload } from "./LoginBackgroundPreload";

/** Shared shell: backgrounds, TopNav, scroll region (used by /login on the website host and / on the app host). */
export function LoginChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden text-[var(--foreground)]">
      <LoginBackgroundPreload />
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <div className="absolute inset-0 bg-[url(/welcome-background-light.png)] bg-cover bg-[center_top] bg-no-repeat opacity-100 transition-opacity duration-[250ms] ease-in-out dark:opacity-0" />
        <div className="absolute inset-0 bg-[url(/welcome-background-dark.png)] bg-cover bg-[center_top] bg-no-repeat opacity-0 transition-opacity duration-[250ms] ease-in-out dark:opacity-100" />
        <div className="absolute inset-0 bg-white/[0.48] opacity-100 transition-opacity duration-[250ms] ease-in-out dark:opacity-0" />
        <div className="absolute inset-0 bg-black/[0.80] opacity-0 transition-opacity duration-[250ms] ease-in-out dark:opacity-100" />
      </div>

      <div className="fixed inset-x-0 top-0 z-20">
        <TopNav variant="glass" />
      </div>
      <div className="relative z-10 min-h-dvh overflow-y-auto overflow-x-hidden">{children}</div>
    </div>
  );
}
