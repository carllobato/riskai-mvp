"use client";

import { useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

export default function DevLoginClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    try {
      const { error: err } = await supabaseBrowserClient().auth.signUp({
        email,
        password,
      });
      if (err) {
        setError(err.message);
        return;
      }
      setStatus("Sign up successful. You may need to confirm your email, or you can Sign In.");
      window.location.href = "/dev/user";
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    try {
      const { error: err } = await supabaseBrowserClient().auth.signInWithPassword({
        email,
        password,
      });
      if (err) {
        setError(err.message);
        return;
      }
      setStatus("Signed in.");
      window.location.href = "/dev/user";
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <form className="space-y-3 max-w-sm">
      <div>
        <label htmlFor="dev-email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          Email
        </label>
        <input
          id="dev-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-neutral-900 dark:text-neutral-100"
          placeholder="you@example.com"
          required
        />
      </div>
      <div>
        <label htmlFor="dev-password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          Password
        </label>
        <input
          id="dev-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-neutral-900 dark:text-neutral-100"
          required
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSignUp}
          className="px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] hover:bg-neutral-100 dark:hover:bg-neutral-700 text-sm font-medium"
        >
          Sign Up
        </button>
        <button
          type="button"
          onClick={handleSignIn}
          className="px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] hover:bg-neutral-100 dark:hover:bg-neutral-700 text-sm font-medium"
        >
          Sign In
        </button>
      </div>
      {status && (
        <p className="text-sm text-green-700 dark:text-green-400">{status}</p>
      )}
      {error && (
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      )}
    </form>
  );
}
