import { z } from "zod";

export const waiverTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  isRequired: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export type WaiverTemplateInput = z.infer<typeof waiverTemplateSchema>;
