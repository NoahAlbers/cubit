import { z } from "zod";

export const memberSearchSchema = z.object({
  search: z.string().optional(),
  status: z.array(z.string()).optional(),
  membershipType: z.array(z.string()).optional(),
  showInactive: z.boolean().optional().default(false),
  sortField: z
    .enum(["name", "joinDate", "status", "lastLoginAt"])
    .optional()
    .default("name"),
  sortDirection: z.enum(["asc", "desc"]).optional().default("asc"),
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().optional().default(25),
});

export type MemberSearchInput = z.infer<typeof memberSearchSchema>;

export const createMemberSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  membershipType: z
    .enum(["STANDARD", "STUDENT", "SCHOLARSHIP", "SPONSORSHIP"])
    .default("STANDARD"),
  roleId: z.string().optional(),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const memberProfileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  paypalEmail: z.string().email().optional().nullable().or(z.literal("")),
  membershipType: z.enum(["STANDARD", "STUDENT", "SCHOLARSHIP", "SPONSORSHIP"]),
  dateOfBirth: z.string().optional().nullable(),
  joinDate: z.string().optional().nullable(),
});

export const emergencyContactSchema = z.object({
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactEmail: z.string().email().optional().nullable().or(z.literal("")),
  emergencyContactPhone: z.string().optional().nullable(),
});

export const statusChangeSchema = z.object({
  status: z.enum(["PROSPECTIVE", "ACTIVE", "HOLD", "PAST_DUE", "SUSPENDED", "CANCELED", "ALUMNI"]),
  reason: z.string().optional(),
});

export const addKeySchema = z.object({
  serialNumber: z.string().min(1, "Serial number is required"),
  type: z.string().optional(),
});

export const addTransactionSchema = z.object({
  transactionDate: z.string(),
  amount: z.string().min(1),
  method: z.enum(["PAYPAL", "CASH", "CHECK", "CREDIT_CARD", "STRIPE", "OTHER"]),
  confirmation: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});
