"use client";

import { useSession } from "next-auth/react";

export function usePermissions() {
  const { data: session } = useSession();

  const permissions = session?.user?.permissions ?? [];
  const role = session?.user?.role ?? "";

  return {
    permissions,
    role,
    hasPermission: (permission: string) => {
      if (role === "Super Admin") return true;
      return permissions.includes(permission);
    },
    isSuperAdmin: role === "Super Admin",
    isAdmin: role === "Super Admin" || role === "Admin",
    isMember: role === "Member",
    isAuthenticated: !!session?.user,
  };
}
