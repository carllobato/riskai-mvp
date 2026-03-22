"use client";

import Link from "next/link";
import { LegalDocumentLink } from "@/components/legal/LegalDocumentLink";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

type Tab = "signin" | "signup";

const inputBaseClass =
  "w-full rounded-md border border-neutral-400 bg-[#F3F5F8] px-3 py-2.5 text-sm text-neutral-950 transition-[border-color,box-shadow] duration-200 ease-out placeholder:text-neutral-600 " +
  "focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/18 " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "dark:border-neutral-500 dark:bg-[#0C0E12] dark:text-neutral-100 dark:placeholder:text-neutral-400 " +
  "dark:focus:border-neutral-300 dark:focus:ring-neutral-300/22";

const subtleLinkClass =
  "cursor-pointer text-xs text-neutral-600 transition-colors duration-200 ease-in-out hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:text-neutral-400 dark:hover:text-neutral-100 dark:focus-visible:outline-neutral-400";

const legalLinkClass =
  "cursor-pointer text-[11px] text-neutral-600 transition-[color,text-decoration-color] duration-200 ease-in-out hover:text-neutral-900 hover:underline hover:decoration-neutral-500/90 hover:underline-offset-2 dark:text-neutral-500 dark:hover:text-neutral-300 dark:hover:decoration-neutral-500";

const primaryButtonClass =
  "relative mt-1 w-full cursor-pointer rounded-md border border-transparent bg-[#111] px-4 py-3 text-sm font-semibold text-white transition-[background-color,border-color] duration-200 ease-out hover:border-white/25 hover:bg-neutral-800 active:border-white/40 active:bg-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-700 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50 " +
  "dark:border-neutral-400/50 dark:bg-white dark:text-neutral-950 dark:hover:border-neutral-500/75 dark:hover:bg-neutral-200 dark:active:border-neutral-600/85 dark:active:bg-neutral-400 dark:focus-visible:outline-neutral-400";

/** Crossfade / collapse timing when switching Sign in ↔ Sign up */
const tabSwitchMs = "duration-[250ms]";
const tabSwitchEase = "ease-in-out";
const tabCrossfadeClass = `transition-opacity ${tabSwitchMs} ${tabSwitchEase}`;
const tabCollapseGridClass = `grid overflow-hidden transition-[grid-template-rows] ${tabSwitchMs} ${tabSwitchEase}`;

/** Toggle to show the Google / Microsoft row again. */
const SHOW_SOCIAL_LOGIN = false;

const oauthButtonClass =
  "flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-neutral-400 bg-[#F3F5F8] px-3 py-2.5 text-sm font-medium text-neutral-900 transition-colors duration-200 ease-out hover:border-neutral-500 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-[0.62] dark:border-neutral-500 dark:bg-[#0C0E12] dark:text-neutral-200 dark:hover:border-neutral-400 dark:hover:bg-neutral-900 dark:focus-visible:outline-neutral-400";

function IconGoogle({ className }: { className?: string }) {
  return (
    <svg className={`pointer-events-none ${className ?? ""}`} viewBox="0 0 24 24" aria-hidden width={18} height={18}>
      <path
        fill="currentColor"
        d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972-3.332 0-6.033-2.701-6.033-6.032s2.701-6.032 6.033-6.032c1.498 0 2.866.549 3.921 1.453l2.814-2.814C17.503 3.988 15.139 3 12.545 3 7.021 3 2.543 7.477 2.543 12s4.478 9 10.002 9c8.396 0 10.249-7.85 9.537-13.961H12.545z"
      />
    </svg>
  );
}

function IconMicrosoft({ className }: { className?: string }) {
  return (
    <svg className={`pointer-events-none ${className ?? ""}`} viewBox="0 0 24 24" aria-hidden width={18} height={18}>
      <path fill="currentColor" d="M2 2h9.5v9.5H2V2z" />
      <path fill="currentColor" d="M12.5 2H22v9.5h-9.5V2z" />
      <path fill="currentColor" d="M2 12.5h9.5V22H2v-9.5z" />
      <path fill="currentColor" d="M12.5 12.5H22V22h-9.5v-9.5z" />
    </svg>
  );
}

function LoginSocialProviders({
  tab,
  formLoading,
  next,
  onClearFormError,
  onError,
}: {
  tab: Tab;
  formLoading: boolean;
  next: string;
  onClearFormError: () => void;
  onError: (message: string) => void;
}) {
  const [microsoftOAuthLoading, setMicrosoftOAuthLoading] = useState(false);

  const handleMicrosoftOAuth = async () => {
    onClearFormError();
    setMicrosoftOAuthLoading(true);
    try {
      const path = next.startsWith("/") && !next.startsWith("//") ? next : "/";
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(path)}`;
      const { data, error: err } = await supabaseBrowserClient().auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo,
          scopes: "email",
          skipBrowserRedirect: true,
        },
      });
      if (err) {
        onError(err.message);
        return;
      }
      if (data.url) {
        window.location.assign(data.url);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setMicrosoftOAuthLoading(false);
    }
  };

  return (
    <div className="mt-5">
      <div className="flex items-center gap-3" role="separator" aria-label="Alternative sign-in options">
        <div className="h-px flex-1 bg-neutral-300 dark:bg-neutral-600" />
        <span className="relative inline-flex min-h-[1rem] shrink-0 items-center justify-center text-xs font-medium text-neutral-600 dark:text-neutral-400">
          <span
            className={`whitespace-nowrap ${tabCrossfadeClass} ${
              tab === "signin" ? "opacity-100" : "pointer-events-none absolute inset-0 opacity-0"
            }`}
          >
            Or continue with
          </span>
          <span
            className={`whitespace-nowrap ${tabCrossfadeClass} ${
              tab === "signup" ? "opacity-100" : "pointer-events-none absolute inset-0 opacity-0"
            }`}
          >
            Sign up with
          </span>
        </span>
        <div className="h-px flex-1 bg-neutral-300 dark:bg-neutral-600" />
      </div>

      <div className="mt-3.5 flex flex-col gap-2 sm:flex-row sm:gap-2.5">
        <button
          type="button"
          disabled
          title="Coming soon"
          className={`${oauthButtonClass} sm:flex-1`}
        >
          <IconGoogle className="shrink-0 text-neutral-800 dark:text-neutral-300" />
          Google
        </button>
        <button
          type="button"
          onClick={() => void handleMicrosoftOAuth()}
          disabled={formLoading || microsoftOAuthLoading}
          title={microsoftOAuthLoading ? "Redirecting…" : undefined}
          className={`${oauthButtonClass} sm:flex-1`}
        >
          <IconMicrosoft className="shrink-0 text-neutral-800 dark:text-neutral-300" />
          {microsoftOAuthLoading ? "Redirecting…" : "Microsoft"}
        </button>
      </div>
    </div>
  );
}

export function LoginClient() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetFormState = () => {
    setError(null);
  };

  useEffect(() => {
    const oauthErr = searchParams.get("error");
    if (oauthErr?.trim()) {
      setError(decodeURIComponent(oauthErr));
    }
  }, [searchParams]);

  const redirectAfterAuth = () => {
    const path = next.startsWith("/") ? next : "/";
    window.location.href = path;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();
    setLoading(true);
    try {
      const { error: err } = await supabaseBrowserClient().auth.signInWithPassword({
        email,
        password,
      });
      if (err) {
        setError(err.message);
        return;
      }
      redirectAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();
    setLoading(true);
    try {
      const { error: err } = await supabaseBrowserClient().auth.signUp({
        email,
        password,
      });
      if (err) {
        setError(err.message);
        return;
      }
      redirectAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = tab === "signin" ? handleSignIn : handleSignUp;

  const tabButton = (id: Tab, label: string) => (
    <button
      type="button"
      onClick={() => {
        if (tab !== id) {
          resetFormState();
        }
        setTab(id);
      }}
      className={`-mb-px cursor-pointer border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors duration-[250ms] ease-in-out ${
        tab === id
          ? "border-neutral-950 text-neutral-950 dark:border-neutral-50 dark:text-neutral-50"
          : "border-transparent text-neutral-700 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full">
      <div className="mb-3.5 flex gap-6 border-b border-neutral-300/95 transition-colors duration-[250ms] ease-in-out dark:border-neutral-600/95">
        {tabButton("signin", "Sign in")}
        {tabButton("signup", "Sign up")}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-neutral-900 transition-colors duration-[250ms] ease-in-out dark:text-neutral-100">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputBaseClass}
            placeholder="you@example.com"
            required
            autoComplete="email"
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-neutral-900 transition-colors duration-[250ms] ease-in-out dark:text-neutral-100">
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputBaseClass} pr-11`}
              required
              autoComplete={tab === "signin" ? "current-password" : "new-password"}
              disabled={loading}
              minLength={6}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded px-1.5 py-1 text-[11px] font-medium text-neutral-600 transition-colors hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-100 dark:focus-visible:outline-neutral-400"
              onClick={() => setShowPassword((v) => !v)}
              disabled={loading}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div
          className={`${tabCollapseGridClass} ${error ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
          aria-hidden={!error}
        >
          <div className="min-h-0 overflow-hidden">
            {error ? (
              <div className="space-y-1.5 text-center" role="alert">
                <p className="text-sm text-red-800 dark:text-red-300/95">{error}</p>
                {tab === "signin" && (
                  <div>
                    <Link href="/forgot-password" className={subtleLinkClass}>
                      Trouble signing in?
                    </Link>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? (
            <span className="flex min-h-[1.25rem] w-full items-center justify-center">Please wait…</span>
          ) : (
            <>
              <span
                className={`flex min-h-[1.25rem] w-full items-center justify-center ${tabCrossfadeClass} ${
                  tab === "signin" ? "opacity-100" : "pointer-events-none absolute inset-0 opacity-0"
                }`}
              >
                Continue to RiskAI
              </span>
              <span
                className={`flex min-h-[1.25rem] w-full items-center justify-center ${tabCrossfadeClass} ${
                  tab === "signup" ? "opacity-100" : "pointer-events-none absolute inset-0 opacity-0"
                }`}
              >
                Sign up
              </span>
            </>
          )}
        </button>
        <div className="relative mt-2">
          <p
            className={`text-center text-[11px] leading-snug text-neutral-500 dark:text-neutral-400 ${tabCrossfadeClass} ${
              tab === "signin"
                ? "opacity-90"
                : "pointer-events-none absolute inset-0 opacity-0"
            }`}
            aria-hidden={tab !== "signin"}
          >
            Secure login | Your data is protected
          </p>
          <p
            className={`text-center text-[11px] leading-snug text-neutral-500 dark:text-neutral-400 ${tabCrossfadeClass} ${
              tab === "signup"
                ? "opacity-90"
                : "pointer-events-none absolute inset-0 opacity-0"
            }`}
            aria-hidden={tab !== "signup"}
          >
            Secure sign up | Your data is protected
          </p>
        </div>
      </form>

      {SHOW_SOCIAL_LOGIN ? (
        <LoginSocialProviders
          tab={tab}
          formLoading={loading}
          next={next}
          onClearFormError={resetFormState}
          onError={setError}
        />
      ) : null}

      <footer className="mt-6 border-t border-neutral-300/90 pt-4 dark:border-neutral-600/90">
        <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
          <LegalDocumentLink document="privacy" className={legalLinkClass}>
            Privacy Policy
          </LegalDocumentLink>
          <span className="select-none text-[11px] text-neutral-500 dark:text-neutral-600" aria-hidden>
            ·
          </span>
          <LegalDocumentLink document="terms" className={legalLinkClass}>
            Terms &amp; Conditions
          </LegalDocumentLink>
        </nav>
      </footer>
    </div>
  );
}
