"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { setSetting } from "@/lib/settings";
import { roleSchema } from "@/lib/validations";

export type ActionState = { error?: string; ok?: boolean };

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

function parseRole(formData: FormData) {
  return roleSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    permissionKeys: formData.getAll("permissions").map(String),
  });
}

async function syncRolePermissions(roleId: string, keys: string[]) {
  const perms = await prisma.permission.findMany({
    where: { key: { in: keys } },
  });
  await prisma.rolePermission.deleteMany({ where: { roleId } });
  await prisma.rolePermission.createMany({
    data: perms.map((p) => ({ roleId, permissionId: p.id })),
  });
}

export async function createRole(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePermission("roles.manage");
  const parsed = parseRole(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await prisma.role.findUnique({ where: { name: parsed.data.name } });
  if (existing) return { error: "A role with that name already exists." };

  const role = await prisma.role.create({
    data: { name: parsed.data.name, description: parsed.data.description || null },
  });
  await syncRolePermissions(role.id, parsed.data.permissionKeys);

  revalidatePath("/admin/settings/roles");
  redirect("/admin/settings/roles");
}

export async function updateRole(
  roleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePermission("roles.manage");
  const parsed = parseRole(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const role = await prisma.role.findUniqueOrThrow({ where: { id: roleId } });

  if (role.isSystem && role.name === "Super Admin")
    return { error: "Super Admin permissions cannot be changed." };

  await prisma.role.update({
    where: { id: roleId },
    data: {
      // System role names are fixed
      name: role.isSystem ? role.name : parsed.data.name,
      description: parsed.data.description || null,
    },
  });
  await syncRolePermissions(roleId, parsed.data.permissionKeys);

  revalidatePath("/admin/settings/roles");
  return { ok: true };
}

export async function deleteRole(roleId: string): Promise<ActionState> {
  await requirePermission("roles.manage");
  const role = await prisma.role.findUniqueOrThrow({
    where: { id: roleId },
    include: { _count: { select: { members: true } } },
  });
  if (role.isSystem) return { error: "System roles cannot be deleted." };
  if (role._count.members > 0)
    return { error: "Reassign this role's members before deleting it." };

  await prisma.role.delete({ where: { id: roleId } });
  revalidatePath("/admin/settings/roles");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// System settings
// ---------------------------------------------------------------------------

export async function saveSystemSettings(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requirePermission("settings.manage");

  const keys = formData.getAll("__keys").map(String);
  for (const key of keys) {
    const fieldType = String(formData.get(`__type:${key}`) ?? "text");
    const raw = formData.get(key);
    let value: unknown;
    switch (fieldType) {
      case "boolean":
        value = raw === "on";
        break;
      case "number":
        value = raw ? Number(raw) : 0;
        if (Number.isNaN(value)) return { error: `"${key}" must be a number.` };
        break;
      case "json":
        try {
          value = JSON.parse(String(raw || "null"));
        } catch {
          return { error: `"${key}" must be valid JSON.` };
        }
        break;
      default:
        value = String(raw ?? "");
    }
    await setSetting(key, value, user.id);
  }

  revalidatePath("/admin/settings/system");
  revalidatePath("/admin/settings/rfid");
  return { ok: true };
}

export async function regenerateRfidToken(): Promise<ActionState> {
  const user = await requirePermission("settings.manage");
  const token = crypto.randomBytes(24).toString("hex");
  await setSetting("rfid.api_token", token, user.id);
  revalidatePath("/admin/settings/rfid");
  return { ok: true };
}
