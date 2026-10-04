import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const LOCAL_ONLY = /^\/(?:queue|run|review|relabel|prompts|export)(?:\/|$)/;
// Pages that require a session. Deliberately not /api/*: those reply 401 JSON.
const PROTECTED_PAGE = /^\/(?:annotate|admin)(?:\/|$)/;

export async function proxy(request: NextRequest) {
  const hosted = process.env.VERCEL === "1" || process.env.PLATFORM_MODE === "hosted";
  if (!hosted) return NextResponse.next({ request });
  if (hosted && (LOCAL_ONLY.test(request.nextUrl.pathname) ||
    request.nextUrl.pathname.startsWith("/api/sidecar/") ||
    request.nextUrl.pathname.startsWith("/api/media/"))) {
    return new NextResponse("Not found", { status: 404 });
  }
  const origin = request.headers.get("origin");
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && origin && origin !== request.nextUrl.origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(items) {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: claims } = await supabase.auth.getClaims();

  // Turn anonymous traffic away here rather than inside the page. The pages
  // call requireProfile(), which redirects too, but /annotate streams a
  // loading.tsx shell first -- once the 200 and the skeleton are on the wire
  // the redirect can no longer be an HTTP status, so a logged-out visitor
  // would watch a placeholder before being bounced. getClaims is a local
  // ES256 signature check (~1ms, no network), so this gate is free.
  // API routes are left alone: they answer 401 as JSON, which is what their
  // callers expect, not a redirect to an HTML page.
  if (!claims?.claims?.sub && PROTECTED_PAGE.test(request.nextUrl.pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
