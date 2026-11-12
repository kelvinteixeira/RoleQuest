import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Signed-in pages are checked on the server before they render: without a
 * valid session the request goes to /login (with ?next= to come back).
 * The session's cookies are refreshed here too. Data access is still guarded
 * by Row Level Security in the database; this keeps pages from even loading.
 *
 * Local mode has no server sessions (everything lives in the browser), so the
 * pages keep their client-side guard there.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (process.env.NEXT_PUBLIC_DATA_SOURCE !== "supabase" || !url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        for (const { name, value } of cookies) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
      },
    },
  });

  // Verifies the token's signature (no trust in what the cookie claims).
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/campaigns/:path*",
    "/campaign/:path*",
    "/characters/:path*",
    "/library/:path*",
    "/settings/:path*",
    "/studio/:path*",
    "/systems/:path*",
    "/join/:path*",
    "/onboarding/:path*",
  ],
};
