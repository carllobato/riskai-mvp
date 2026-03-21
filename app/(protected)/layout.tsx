import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabaseServerClient } from "@/lib/supabase/server";
import { ProtectedShell } from "@/components/layout/ProtectedShell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const pathname = (await headers()).get("x-pathname") ?? "/";
    const loginUrl = `/login${pathname ? `?next=${encodeURIComponent(pathname)}` : ""}`;
    redirect(loginUrl);
  }

  return <ProtectedShell>{children}</ProtectedShell>;
}
