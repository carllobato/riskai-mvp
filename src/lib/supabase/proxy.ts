import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  APP_ORIGIN,
  isAppAreaPath,
  isAppHost,
  isLocalhost,
  isWebsiteHost,
  SITE_ORIGIN,
} from "@/lib/host";
import { DASHBOARD_PATH } from "@/lib/routes";
import { env } from "@/lib/env";

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getHost(request: NextRequest): string {
  return request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
}

function isPublicPath(pathname: string, host: string): boolean {
  if (isAppHost(host)) {
    return (
      pathname === "/" ||
      pathname === "/login" ||
      pathname.startsWith("/auth/callback") ||
      pathname.startsWith("/forgot-password")
    );
  }
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/forgot-password")
  );
}

export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = getHost(request);

  // Website host: send app routes to the app origin
  if (isWebsiteHost(host) && isAppAreaPath(pathname)) {
    return NextResponse.redirect(new URL(pathname + search, APP_ORIGIN));
  }

  // App host: canonical legal pages live on the website (skip in local dev)
  if (isAppHost(host) && !isLocalhost(host) && (pathname === "/privacy" || pathname === "/terms")) {
    return NextResponse.redirect(new URL(pathname + search, SITE_ORIGIN));
  }

  // App host: /login is an alias for / (login UI lives at /)
  if (isAppHost(host) && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // API routes: no redirect; handlers use requireUser() and return 401 JSON
  if (pathname.startsWith("/api")) {
    return NextResponse.next({ request });
  }

  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  const requestWithPath = new Request(request.url, {
    method: request.method,
    headers,
  });

  const response = NextResponse.next({
    request: requestWithPath,
  });

  try {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (isPublicPath(pathname, host)) {
      if (user && pathname === "/login") {
        if (isWebsiteHost(host)) {
          return NextResponse.redirect(new URL(DASHBOARD_PATH, APP_ORIGIN));
        }
        return NextResponse.redirect(new URL(DASHBOARD_PATH, request.url));
      }
      return response;
    }

    return response;
  } catch {
    return response;
  }
}
