import { Suspense } from "react";
import { LoginClient } from "./LoginClient";

export default function LoginPage() {
  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <h1 className="text-xl font-semibold text-[var(--foreground)] mb-6">
        Sign in to RiskAI
      </h1>
      <Suspense fallback={<div className="text-sm text-neutral-500">Loading…</div>}>
        <LoginClient />
      </Suspense>
    </main>
  );
}
