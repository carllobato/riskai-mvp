import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabaseServerClient } from "@/lib/supabase/server";

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
    const pathname = (await headers()).get("x-pathname") ?? "/risk-register";
    const loginUrl = `/login${pathname ? `?next=${encodeURIComponent(pathname)}` : ""}`;
    redirect(loginUrl);
  }

  return <>{children}</>;
}
