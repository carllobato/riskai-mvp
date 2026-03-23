import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { WelcomePage } from "@/components/marketing/WelcomePage";
import { supabaseServerClient } from "@/lib/supabase/server";
import { isAppHost, isWebsiteHost } from "@/lib/host";
import { DASHBOARD_PATH } from "@/lib/routes";
import { LoginChrome } from "./login/LoginChrome";
import { LoginPageShell } from "./login/LoginPageShell";

/**
 * Website host: marketing home.
 * App host: login when signed out; signed-in users go to the dashboard.
 */
export default async function HomePage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";

  if (isWebsiteHost(host)) {
    return <WelcomePage />;
  }

  if (isAppHost(host)) {
    const supabase = await supabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect(DASHBOARD_PATH);
    }
    return (
      <LoginChrome>
        <LoginPageShell />
      </LoginChrome>
    );
  }

  return <WelcomePage />;
}
