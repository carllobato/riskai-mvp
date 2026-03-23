"use client";

import { useEffect, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

export default function DevSupabasePage() {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = supabaseBrowserClient();
        await client.auth.getUser();
        if (!cancelled) {
          setStatus("ok");
          setMessage("Supabase connected ✅");
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setMessage(
            err instanceof Error ? err.message : String(err)
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return (
      <main className="p-6 max-w-2xl">
        <h1 className="text-xl font-semibold m-0 mb-4">Supabase connection</h1>
        <p className="text-neutral-600 dark:text-neutral-400">Checking…</p>
      </main>
    );
  }

  if (status === "ok") {
    return (
      <main className="p-6 max-w-2xl">
        <h1 className="text-xl font-semibold m-0 mb-4">Supabase connection</h1>
        <p className="text-green-700 dark:text-green-400 font-medium">{message}</p>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold m-0 mb-4">Supabase connection</h1>
      <p className="text-red-700 dark:text-red-400 font-medium">
        Supabase error ❌: {message}
      </p>
    </main>
  );
}
