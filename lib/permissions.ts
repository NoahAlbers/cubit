import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export type AuthUser = {
  id: string;
  role: string;
  permissions: string[];
  email?: string | null;
  name?: string | null;
};

/**
 * Get the current authenticated user from the session.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    role: session.user.role,
    permissions: session.user.permissions,
    email: session.user.email,
    name: session.user.name,
  };
}

/**
 * Require authentication and specific permission(s).
 * Throws/redirects if not authorized.
 * Use in server actions and server components.
 */
export async function requirePermission(
  permission: string | string[]
): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Super Admin always has all permissions
  if (user.role === "Super Admin") {
    return user;
  }

  const required = Array.isArray(permission) ? permission : [permission];
  const hasAll = required.every((p) => user.permissions.includes(p));

  if (!hasAll) {
    throw new Error("Forbidden: insufficient permissions");
  }

  return user;
}

/**
 * Require authentication only (any role).
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Pure boolean check — does the user have the required permission?
 */
export function hasPermission(
  permissions: string[],
  required: string
): boolean {
  return permissions.includes(required);
}

/**
 * Check if user is Super Admin.
 */
export function isSuperAdmin(user: AuthUser): boolean {
  return user.role === "Super Admin";
}

/**
 * Check if a resource belongs to the current user.
 * Used for member self-service routes.
 */
export function isOwnResource(
  userId: string,
  resourceOwnerId: string
): boolean {
  return userId === resourceOwnerId;
}
