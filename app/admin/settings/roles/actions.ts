"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { createRoleSchema, updateRoleSchema } from "@/lib/validations/role";
import { revalidatePath } from "next/cache";

export async function getRoles() {
  await requirePermission("roles.view");

  const roles = await prisma.role.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { members: true } },
      permissions: {
        include: { permission: true },
      },
    },
  });

  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    memberCount: role._count.members,
    permissions: role.permissions.map((rp) => ({
      id: rp.permission.id,
      key: rp.permission.key,
      name: rp.permission.name,
      category: rp.permission.category,
    })),
    createdAt: role.createdAt.toISOString(),
  }));
}

export type RoleItem = Awaited<ReturnType<typeof getRoles>>[number];

export async function getPermissions() {
  await requirePermission("roles.view");

  const permissions = await prisma.permission.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  // Group by category
  const grouped: Record<
    string,
    { id: string; key: string; name: string; description: string | null }[]
  > = {};

  for (const p of permissions) {
    if (!grouped[p.category]) {
      grouped[p.category] = [];
    }
    grouped[p.category].push({
      id: p.id,
      key: p.key,
      name: p.name,
      description: p.description,
    });
  }

  return grouped;
}

export type PermissionGroup = Awaited<ReturnType<typeof getPermissions>>;

export async function createRole(data: unknown) {
  await requirePermission("roles.manage");

  const parsed = createRoleSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const { name, description, permissionIds } = parsed.data;

  // Check for duplicate name
  const existing = await prisma.role.findUnique({ where: { name } });
  if (existing) {
    return { error: "A role with this name already exists" };
  }

  const role = await prisma.role.create({
    data: {
      name,
      description: description || null,
      permissions: {
        create: permissionIds.map((permissionId) => ({ permissionId })),
      },
    },
  });

  revalidatePath("/admin/settings/roles");
  return { success: true, roleId: role.id };
}

export async function updateRole(roleId: string, data: unknown) {
  await requirePermission("roles.manage");

  const parsed = updateRoleSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const { name, description, permissionIds } = parsed.data;

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    return { error: "Role not found" };
  }

  // Cannot change system role name
  if (role.isSystem && role.name !== name) {
    return { error: "Cannot change the name of a system role" };
  }

  // Check for duplicate name (excluding current)
  const existing = await prisma.role.findFirst({
    where: { name, id: { not: roleId } },
  });
  if (existing) {
    return { error: "A role with this name already exists" };
  }

  // Delete existing permissions and recreate
  await prisma.rolePermission.deleteMany({ where: { roleId } });

  await prisma.role.update({
    where: { id: roleId },
    data: {
      name,
      description: description || null,
      permissions: {
        create: permissionIds.map((permissionId) => ({ permissionId })),
      },
    },
  });

  revalidatePath("/admin/settings/roles");
  revalidatePath(`/admin/settings/roles/${roleId}`);
  return { success: true };
}

export async function deleteRole(roleId: string) {
  await requirePermission("roles.manage");

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { _count: { select: { members: true } } },
  });

  if (!role) {
    return { error: "Role not found" };
  }

  if (role.isSystem) {
    return { error: "Cannot delete a system role" };
  }

  if (role._count.members > 0) {
    return {
      error: `Cannot delete this role — ${role._count.members} member(s) are still assigned to it`,
    };
  }

  await prisma.role.delete({ where: { id: roleId } });

  revalidatePath("/admin/settings/roles");
  return { success: true };
}
