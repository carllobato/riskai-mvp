"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ACCOUNT_PROFILE_UPDATED_EVENT } from "@/lib/onboarding/types";
import { saveUserProfileThroughApi } from "@/lib/profiles/profileDb";

const SAVED_RESET_DELAY_MS = 2500;

type Props = {
  initialFirstName?: string | null;
  initialLastName?: string | null;
  initialCompany?: string | null;
  initialRole?: string | null;
};

export function AccountProfileForm({
  initialFirstName = "",
  initialLastName = "",
  initialCompany = "",
  initialRole = "",
}: Props) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialFirstName ?? "");
  const [lastName, setLastName] = useState(initialLastName ?? "");
  const [company, setCompany] = useState(initialCompany ?? "");
  const [role, setRole] = useState(initialRole ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setMessage(null);
    const fn = firstName.trim();
    const ln = lastName.trim();
    const co = company.trim();
    if (!fn || !ln || !co) {
      setStatus("error");
      setMessage("First name, surname, and company are required.");
      return;
    }
    const { error: errMsg } = await saveUserProfileThroughApi({
      first_name: fn,
      last_name: ln,
      company: co,
      role: role.trim() || null,
    });
    if (errMsg) {
      setStatus("error");
      setMessage(errMsg);
      return;
    }
    setStatus("saved");
    setMessage("Profile updated. This will appear as “Triggered by” on Run Data.");
    window.dispatchEvent(new CustomEvent(ACCOUNT_PROFILE_UPDATED_EVENT));
    router.refresh();
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
          First name <span className="text-red-600 dark:text-red-400">*</span>
        </label>
        <input
          id="profile-first-name"
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={inputClass}
          placeholder="First name"
          autoComplete="given-name"
          required
        />
      </div>
      <div>
        <label htmlFor="profile-last-name" className={labelClass}>
          Surname <span className="text-red-600 dark:text-red-400">*</span>
        </label>
        <input
          id="profile-last-name"
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className={inputClass}
          placeholder="Surname"
          autoComplete="family-name"
          required
        />
      </div>
      <div>
        <label htmlFor="profile-company" className={labelClass}>
          Company <span className="text-red-600 dark:text-red-400">*</span>
        </label>
        <input
          id="profile-company"
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className={inputClass}
          placeholder="Company"
          autoComplete="organization"
          required
        />
      </div>
      <div>
        <label htmlFor="profile-role" className={labelClass}>
          Role
        </label>
        <input
          id="profile-role"
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={inputClass}
          placeholder="e.g. Risk manager"
          autoComplete="organization-title"
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
