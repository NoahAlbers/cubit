import { z } from "zod";

export const memberProfileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  paypalEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  membershipType: z.enum(["STANDARD", "STUDENT", "SCHOLARSHIP", "SPONSORSHIP"]),
  dateOfBirth: z.string().optional().or(z.literal("")),
  joinDate: z.string().optional().or(z.literal("")),
  emergencyContactName: z.string().trim().max(150).optional().or(z.literal("")),
  emergencyContactEmail: z.string().trim().email().optional().or(z.literal("")),
  emergencyContactPhone: z.string().trim().max(30).optional().or(z.literal("")),
});

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(200);

export const transactionSchema = z.object({
  amount: z.coerce.number().finite(),
  transactionDate: z.string().min(1, "Date is required"),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  method: z.enum(["PAYPAL", "CASH", "CHECK", "CREDIT_CARD", "STRIPE", "OTHER"]),
  confirmation: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const keySchema = z.object({
  serialNumber: z
    .string()
    .trim()
    .min(4, "Serial number is required")
    .max(64)
    .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers, and dashes only"),
  type: z.enum(["fob", "card"]).default("fob"),
});

export const equipmentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  location: z.string().trim().max(150).optional().or(z.literal("")),
  category: z.string().trim().max(100).optional().or(z.literal("")),
  serialNumber: z.string().trim().max(100).optional().or(z.literal("")),
  status: z.enum(["OPERATIONAL", "MAINTENANCE", "OUT_OF_ORDER", "RETIRED"]),
  requiresCertification: z.coerce.boolean(),
});

export const waiverTemplateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  content: z.string().trim().min(50, "Waiver text is required (min 50 chars)"),
  isRequired: z.coerce.boolean(),
  isActive: z.coerce.boolean(),
});

export const waiverSignatureSchema = z.object({
  waiverId: z.string().uuid(),
  signedName: z.string().trim().min(3, "Type your full legal name"),
  signatureData: z
    .string()
    .startsWith("data:image/png;base64,", "Signature drawing is required")
    .max(400_000),
  agree: z.literal("on", { message: "You must agree to the terms" }),
});

export const planSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  monthlyCost: z.coerce.number().min(0),
  keysIncluded: z.coerce.number().int().min(0).max(10),
  isActive: z.coerce.boolean(),
});

export const roleSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  permissionKeys: z.array(z.string()),
});
