"use client";

import Link from "next/link";
import { useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

const inputClass =
  "w-full rounded-md border border-neutral-400 bg-[#F3F5F8] px-3 py-2.5 text-sm text-neutral-950 transition-[border-color,box-shadow] duration-200 ease-out placeholder:text-neutral-600 " +
  "focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/18 " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "dark:border-neutral-500 dark:bg-[#0C0E12] dark:text-neutral-100 dark:placeholder:text-neutral-400 " +
  "dark:focus:border-neutral-300 dark:focus:ring-neutral-300/22";

const primaryButtonClass =
  "mt-1 w-full cursor-pointer rounded-md border border-transparent bg-[#111] px-4 py-3 text-sm font-semibold text-white transition-[background-color,border-color] duration-200 ease-out hover:border-white/25 hover:bg-neutral-800 active:border-white/40 active:bg-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-700 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50 " +
  "dark:border-neutral-400/50 dark:bg-white dark:text-neutral-950 dark:hover:border-neutral-500/75 dark:hover:bg-neutral-200 dark:active:border-neutral-600/85 dark:active:bg-neutral-400 dark:focus-visible:outline-neutral-400";

const subtleLinkClass =
  "text-xs text-neutral-600 transition-colors duration-200 ease-in-out hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:text-neutral-400 dark:hover:text-neutral-100 dark:focus-visible:outline-neutral-400";

export function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const origin = window.location.origin;
      const { error: err } = await supabaseBrowserClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/login`,
      });
      if (err) {
        setError(err.message);
        return;
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="w-full space-y-4 text-center">
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          If an account exists for <span className="font-medium text-neutral-900 dark:text-neutral-100">{email}</span>, you
          will receive an email with a link to reset your password.
        </p>
        <Link href="/login" className={`inline-block font-medium ${subtleLinkClass}`}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Enter your email and we&apos;ll send you a reset link.
      </p>
      <div>
        <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium text-neutral-900 dark:text-neutral-100">
          Email
        </label>
        <input
          id="forgot-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="you@example.com"
          required
          autoComplete="email"
          disabled={loading}
        />
      </div>
      {error ? (
        <p className="text-sm text-red-800 dark:text-red-300/95" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={loading} className={primaryButtonClass}>
        {loading ? "Sending…" : "Send reset link"}
      </button>
      <div className="pt-1 text-center">
        <Link href="/login" className={subtleLinkClass}>
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
