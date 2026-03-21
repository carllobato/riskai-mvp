import { ForgotPasswordClient } from "./ForgotPasswordClient";

const t = "transition-[background-color,border-color,box-shadow,opacity,color] duration-[250ms] ease-in-out";

export default function ForgotPasswordPage() {
  return (
    <main className="relative flex min-h-full flex-col items-center justify-center px-4 py-8">
      <div
        className={[
          "relative w-full max-w-md overflow-hidden rounded-lg border",
          "border-black/[0.14]",
          "shadow-[0_1px_0_rgba(0,0,0,0.06),0_4px_14px_-2px_rgba(0,0,0,0.09)]",
          "dark:border-white/[0.12]",
          "dark:shadow-[0_1px_0_rgba(0,0,0,0.35),0_4px_16px_-2px_rgba(0,0,0,0.55)]",
          t,
        ].join(" ")}
      >
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

        <div className={`relative z-10 bg-white/[0.64] p-5 dark:bg-[rgb(20_20_20_/_0.68)] ${t}`}>
          <h1 className={`mb-4 text-center text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 ${t}`}>
            Reset password
          </h1>
          <ForgotPasswordClient />
        </div>
      </div>
    </main>
  );
}
