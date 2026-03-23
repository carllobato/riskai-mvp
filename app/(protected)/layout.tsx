import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isDevAuthBypassEnabled } from "@/lib/dev/devAuthBypass";
import { supabaseServerClient } from "@/lib/supabase/server";
import { ProtectedShell } from "@/components/layout/ProtectedShell";
import { buildLoginRedirectUrl } from "@/lib/auth/loginRedirect";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = (await headers()).get("x-pathname") ?? "/";

  if (!user && !isDevAuthBypassEnabled()) {
    redirect(await buildLoginRedirectUrl(pathname));
  }
  return <ProtectedShell>{children}</ProtectedShell>;
}
