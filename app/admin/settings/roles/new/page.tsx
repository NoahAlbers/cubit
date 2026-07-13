import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { RoleForm } from "../role-form";

export const dynamic = "force-dynamic";

export default async function NewRolePage() {
  await requirePermission("roles.manage");
  const permissions = await prisma.permission.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return (
    <RoleForm
      defaults={{ name: "", description: "", permissionKeys: [] }}
      permissions={permissions.map((p) => ({
        key: p.key,
        category: p.category,
        name: p.name,
      }))}
      canManage
    />
  );
}
