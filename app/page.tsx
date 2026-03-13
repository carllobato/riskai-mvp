import { redirect } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/projects");
  }

  redirect("/login?next=" + encodeURIComponent("/"));
}
