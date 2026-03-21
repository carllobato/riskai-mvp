import { Suspense } from "react";
import { LoginClient } from "./LoginClient";

const t =
  "transition-[background-color,border-color,box-shadow,opacity,color,backdrop-filter] duration-[250ms] ease-in-out";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-full flex-col items-center justify-center px-4 py-8">
      <div
        className={[
          "relative w-full max-w-md overflow-hidden rounded-lg border border-solid border-[rgba(255,255,255,0.08)]",
          "shadow-[0_1px_0_rgba(0,0,0,0.06),0_8px_32px_-4px_rgba(0,0,0,0.09)]",
          "dark:shadow-[0_1px_0_rgba(0,0,0,0.35),0_8px_36px_-4px_rgba(0,0,0,0.55)]",
          t,
        ].join(" ")}
      >
        {/* Translucent wash within the card */}
        <div
          className={`pointer-events-none absolute inset-0 rounded-[inherit] bg-white/0 dark:bg-black/0 ${t}`}
          aria-hidden
        />
        {/* Vignette: crossfade instead of display toggle */}
        <div
          className={`pointer-events-none absolute inset-0 rounded-[inherit] opacity-100 transition-opacity duration-[250ms] ease-in-out dark:opacity-0`}
          style={{
            background:
              "radial-gradient(ellipse 78% 72% at 50% 45%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.06) 100%)",
          }}
          aria-hidden
        />
        <div
          className={`pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-[250ms] ease-in-out dark:opacity-100`}
          style={{
            background:
              "radial-gradient(ellipse 78% 72% at 50% 45%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.22) 100%)",
          }}
          aria-hidden
        />

        <div
          className={`relative z-10 bg-white/[0.64] p-5 backdrop-blur-[20px] dark:bg-[rgb(20_20_20_/_0.68)] ${t}`}
        >
          <h1 className={`mb-4 text-center text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 ${t}`}>
            Sign in to RiskAI
          </h1>
          <Suspense fallback={<div className="text-center text-sm text-neutral-700 dark:text-neutral-400">Loading…</div>}>
            <LoginClient />
          </Suspense>
        </div>
      </div>
      <div className="absolute bottom-4 left-0 right-0 text-xs text-neutral-400 dark:text-neutral-500 text-center px-4">
        © {new Date().getFullYear()} Visualify. All rights reserved.
      </div>
    </main>
  );
}
