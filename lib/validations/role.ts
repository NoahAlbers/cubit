import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).default([]),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).default([]),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
