import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export type AuthUser = {
  id: string;
  role: string;
  permissions: string[];
  email?: string | null;
  name?: string | null;
};

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    role: session.user.role,
    permissions: session.user.permissions ?? [],
    email: session.user.email,
    name: session.user.name,
  };
}

export function hasPermission(user: AuthUser, permission: string): boolean {
  if (user.role === "Super Admin") return true;
  return user.permissions.includes(permission);
}

/**
 * Require authentication + specific permission(s).
 * Redirects to /login when unauthenticated; throws on missing permission.
 * Use in server components, server actions, and route handlers.
 */
export async function requirePermission(
  permission: string | string[]
): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const required = Array.isArray(permission) ? permission : [permission];
  if (!required.every((p) => hasPermission(user, p))) {
    throw new Error("You don't have permission to do that.");
  }
  return user;
}

/** Require any authenticated user. */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Landing route for a user based on their role. */
export function homeFor(role: string) {
  return role === "Member" ? "/member/dashboard" : "/admin/dashboard";
}
