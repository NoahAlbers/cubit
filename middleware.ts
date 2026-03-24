import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const { pathname } = request.nextUrl;

  // Public routes that don't require auth
  const publicRoutes = ["/login", "/magic-link", "/set-password", "/reset-password", "/api/auth"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // If not authenticated and trying to access protected route
  if (!token && !isPublicRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated and trying to access login page, redirect based on role
  if (token && pathname === "/login") {
    const role = token.role as string;
    if (role === "Member") {
      return NextResponse.redirect(new URL("/member/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/admin/members", request.url));
  }

  // Protect admin routes — require non-Member role
  if (pathname.startsWith("/admin")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const role = token.role as string;
    if (role === "Member") {
      return NextResponse.redirect(new URL("/member/dashboard", request.url));
    }
  }

  // Protect member routes — require authentication
  if (pathname.startsWith("/member")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
