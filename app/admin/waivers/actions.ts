"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { waiverTemplateSchema } from "@/lib/validations";

export type ActionState = { error?: string; ok?: boolean };

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function parseTemplate(formData: FormData) {
  return waiverTemplateSchema.safeParse({
    name: fd(formData, "name"),
    description: fd(formData, "description"),
    content: fd(formData, "content"),
    isRequired: fd(formData, "isRequired") === "on",
    isActive: fd(formData, "isActive") === "on",
  });
}

export async function createWaiverTemplate(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePermission("waivers.manage");
  const parsed = parseTemplate(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const t = await prisma.waiverTemplate.create({
    data: { ...parsed.data, description: parsed.data.description || null },
  });
  revalidatePath("/admin/waivers");
  redirect(`/admin/waivers/${t.id}`);
}

export async function updateWaiverTemplate(
  templateId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePermission("waivers.manage");
  const parsed = parseTemplate(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await prisma.waiverTemplate.findUniqueOrThrow({
    where: { id: templateId },
  });

  // Changing the legal text bumps the version so future signatures record
  // which revision was agreed to.
  const contentChanged = existing.content !== parsed.data.content;

  await prisma.waiverTemplate.update({
    where: { id: templateId },
    data: {
      ...parsed.data,
      description: parsed.data.description || null,
      version: contentChanged ? existing.version + 1 : existing.version,
    },
  });
  revalidatePath(`/admin/waivers/${templateId}`);
  revalidatePath("/admin/waivers");
  return { ok: true };
}
