import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = [
  "/login",
  "/magic-link",
  "/set-password",
  "/reset-password",
  "/api/auth",
  "/api/rfid", // authenticated via its own API token
  "/api/cron", // authenticated via CRON_SECRET
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));
  const token = await getToken({ req: request });

  if (!token && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token) {
    const home =
      token.role === "Member" ? "/member/dashboard" : "/admin/dashboard";

    // Signed-in users skip the auth pages and the root page
    if (pathname === "/login" || pathname === "/") {
      return NextResponse.redirect(new URL(home, request.url));
    }

    // Members can't open the admin app
    if (pathname.startsWith("/admin") && token.role === "Member") {
      return NextResponse.redirect(new URL("/member/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|otf|woff2?)$).*)",
  ],
};
