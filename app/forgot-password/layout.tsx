import { TopNav } from "@/components/layout/TopNav";
import { LoginBackgroundPreload } from "../login/LoginBackgroundPreload";

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-screen flex-col overflow-hidden text-[var(--foreground)]">
      <LoginBackgroundPreload />
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <div className="absolute inset-0 bg-[url(/welcome-background-light.png)] bg-cover bg-[center_top] bg-no-repeat opacity-100 transition-opacity duration-[250ms] ease-in-out dark:opacity-0" />
        <div className="absolute inset-0 bg-[url(/welcome-background-dark.png)] bg-cover bg-[center_top] bg-no-repeat opacity-0 transition-opacity duration-[250ms] ease-in-out dark:opacity-100" />
        <div className="absolute inset-0 bg-white/[0.48] opacity-100 transition-opacity duration-[250ms] ease-in-out dark:opacity-0" />
        <div className="absolute inset-0 bg-black/[0.80] opacity-0 transition-opacity duration-[250ms] ease-in-out dark:opacity-100" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <TopNav variant="glass" />
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
