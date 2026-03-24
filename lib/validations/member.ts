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
