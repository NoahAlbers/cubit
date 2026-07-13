import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { RoleForm } from "../role-form";

export const dynamic = "force-dynamic";

export default async function EditRolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("roles.view");
  const { id } = await params;

  const [role, permissions] = await Promise.all([
    prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { members: true } },
      },
    }),
    prisma.permission.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  ]);
  if (!role) notFound();

  return (
    <RoleForm
      roleId={role.id}
      defaults={{
        name: role.name,
        description: role.description ?? "",
        permissionKeys: role.permissions.map((rp) => rp.permission.key),
      }}
      permissions={permissions.map((p) => ({
        key: p.key,
        category: p.category,
        name: p.name,
      }))}
      isSystem={role.isSystem}
      isSuperAdmin={role.name === "Super Admin"}
      memberCount={role._count.members}
      canManage={hasPermission(user, "roles.manage")}
    />
  );
}
