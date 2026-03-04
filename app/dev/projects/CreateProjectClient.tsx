"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

export default function CreateProjectClient() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const supabase = supabaseBrowserClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setMessage({ type: "error", text: userError?.message ?? "Not signed in." });
      return;
    }
    const { error } = await supabase.from("projects").insert({ owner_id: user.id, name });
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    setMessage({ type: "success", text: "Project created." });
    setName("");
    router.refresh();
  };

  return (
    <form onSubmit={handleCreate} className="space-y-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name"
        className="w-full max-w-xs px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-neutral-900 dark:text-neutral-100"
        required
      />
      <button
        type="submit"
        className="px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] hover:bg-neutral-100 dark:hover:bg-neutral-700 text-sm font-medium"
      >
        Create
      </button>
      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
