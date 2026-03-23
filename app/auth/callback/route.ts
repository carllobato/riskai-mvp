import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getLoginPathForHost } from "@/lib/host";
import { env } from "@/lib/env";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/";
  }
  return raw;
}

function authErrorRedirect(request: NextRequest, message: string): NextResponse {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const base = getLoginPathForHost(host);
  const url = new URL(request.url);
  if (base === "/") {
    url.pathname = "/";
    url.search = `?error=${encodeURIComponent(message)}`;
    url.hash = "";
  } else {
    url.pathname = "/login";
    url.search = `?error=${encodeURIComponent(message)}`;
    url.hash = "";
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");
  const next = safeNextPath(url.searchParams.get("next"));

  if (oauthError) {
    const desc = url.searchParams.get("error_description") ?? oauthError;
    return authErrorRedirect(request, desc);
  }

  if (!code) {
    return authErrorRedirect(request, "missing_code");
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return authErrorRedirect(request, error.message);
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  const destinationBase =
    !isLocal && forwardedHost ? `https://${forwardedHost}` : url.origin;

  return NextResponse.redirect(new URL(next, destinationBase));
}
