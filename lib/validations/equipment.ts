import { z } from "zod";

export const equipmentSearchSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  requiresCert: z.enum(["true", "false"]).optional(),
  sortField: z
    .enum(["name", "status", "category", "location"])
    .optional()
    .default("name"),
  sortDirection: z.enum(["asc", "desc"]).optional().default("asc"),
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().optional().default(25),
});

export type EquipmentSearchInput = z.infer<typeof equipmentSearchSchema>;

export const createEquipmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  location: z.string().optional(),
  category: z.string().optional(),
  serialNumber: z.string().optional(),
  status: z
    .enum(["OPERATIONAL", "MAINTENANCE", "OUT_OF_ORDER", "RETIRED"])
    .optional()
    .default("OPERATIONAL"),
  requiresCertification: z.boolean().optional().default(false),
});

export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>;

export const updateEquipmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  status: z.enum(["OPERATIONAL", "MAINTENANCE", "OUT_OF_ORDER", "RETIRED"]),
  requiresCertification: z.boolean(),
  purchaseDate: z.string().optional().nullable(),
  warrantyExpiration: z.string().optional().nullable(),
});

export const maintenanceLogSchema = z.object({
  maintenanceDate: z.string().min(1, "Date is required"),
  description: z.string().min(1, "Description is required"),
  cost: z.string().optional(),
  nextDueDate: z.string().optional(),
});

export const equipmentCertificationSchema = z.object({
  memberId: z.string().min(1, "Member is required"),
  certifiedDate: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});
