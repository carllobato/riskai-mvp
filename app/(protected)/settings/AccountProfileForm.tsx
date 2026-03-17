"use client";

import { useState, useEffect } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

const SAVED_RESET_DELAY_MS = 2500;

type Props = {
  initialFirstName?: string | null;
  initialLastName?: string | null;
  initialCompany?: string | null;
};

export function AccountProfileForm({
  initialFirstName = "",
  initialLastName = "",
  initialCompany = "",
}: Props) {
  const [firstName, setFirstName] = useState(initialFirstName ?? "");
  const [lastName, setLastName] = useState(initialLastName ?? "");
  const [company, setCompany] = useState(initialCompany ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setMessage(null);
    const supabase = supabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({
      data: {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        company: company.trim() || null,
      },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("saved");
    setMessage("Profile updated. This will appear as “Triggered by” on Run Data.");
  }

  useEffect(() => {
    if (status !== "saved") return;
    const id = setTimeout(() => {
      setStatus("idle");
      setMessage(null);
    }, SAVED_RESET_DELAY_MS);
    return () => clearTimeout(id);
  }, [status]);

  const inputClass =
    "w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500";
  const labelClass = "block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="profile-first-name" className={labelClass}>
          First name
        </label>
        <input
          id="profile-first-name"
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={inputClass}
          placeholder="First name"
          autoComplete="given-name"
        />
      </div>
      <div>
        <label htmlFor="profile-last-name" className={labelClass}>
          Surname
        </label>
        <input
          id="profile-last-name"
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className={inputClass}
          placeholder="Surname"
          autoComplete="family-name"
        />
      </div>
      <div>
        <label htmlFor="profile-company" className={labelClass}>
          Company
        </label>
        <input
          id="profile-company"
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className={inputClass}
          placeholder="Company"
          autoComplete="organization"
        />
      </div>
      {message && (
        <p
          className={`text-sm ${
            status === "error"
              ? "text-red-600 dark:text-red-400"
              : "text-neutral-600 dark:text-neutral-400"
          }`}
        >
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={status === "saving"}
        className="inline-flex px-4 py-2 text-sm font-medium rounded-md bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 hover:bg-neutral-700 dark:hover:bg-neutral-100 disabled:opacity-50"
      >
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save profile"}
      </button>
    </form>
  );
}
