"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

type Tab = "signin" | "signup";

export function LoginClient() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetFormState = () => {
    setError(null);
  };

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

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="flex gap-2 mb-4 border-b border-neutral-200 dark:border-neutral-700">
        <button
          type="button"
          onClick={() => {
            setTab("signin");
            resetFormState();
          }}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "signin"
              ? "border-[var(--foreground)] text-[var(--foreground)]"
              : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-[var(--foreground)]"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("signup");
            resetFormState();
          }}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "signup"
              ? "border-[var(--foreground)] text-[var(--foreground)]"
              : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-[var(--foreground)]"
          }`}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="login-email"
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1"
          >
            Email
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-neutral-900 dark:text-neutral-100"
            placeholder="you@example.com"
            required
            autoComplete="email"
            disabled={loading}
          />
        </div>
        <div>
          <label
            htmlFor="login-password"
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1"
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-neutral-900 dark:text-neutral-100"
            required
            autoComplete={tab === "signin" ? "current-password" : "new-password"}
            disabled={loading}
            minLength={6}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] hover:bg-neutral-100 dark:hover:bg-neutral-700 text-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? "Please wait…" : tab === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>
    </div>
  );
}
