import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

const PUBLIC_PATHS = ["/login", "/auth/callback"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function updateSession(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // API routes: no redirect; handlers use requireUser() and return 401 JSON
  if (pathname.startsWith("/api")) {
    return NextResponse.next({ request });
  }

  // Pass pathname to server so (protected) layout can use it for ?next=
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

    // Refresh session (updates cookies if needed)
    await supabase.auth.getUser();

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (isPublicPath(pathname)) {
      if (user && pathname === "/login") {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return response;
    }

    // Page auth is enforced by app/(protected)/layout.tsx; do not redirect here
    return response;
  } catch {
    return response;
  }
}
