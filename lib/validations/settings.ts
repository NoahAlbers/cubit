import { z } from "zod";

/**
 * Validate a setting value based on its fieldType.
 */
export function validateSettingValue(
  fieldType: string,
  value: unknown,
  options?: unknown
): { success: true; data: unknown } | { success: false; error: string } {
  try {
    switch (fieldType) {
      case "text": {
        const parsed = z.string().parse(value);
        return { success: true, data: parsed };
      }
      case "number": {
        const parsed = z.coerce.number().parse(value);
        return { success: true, data: parsed };
      }
      case "boolean": {
        const parsed = z.coerce.boolean().parse(value);
        return { success: true, data: parsed };
      }
      case "email": {
        const parsed = z.string().email("Invalid email address").parse(value);
        return { success: true, data: parsed };
      }
      case "select": {
        const validOptions = Array.isArray(options)
          ? options.map(String)
          : [];
        if (validOptions.length > 0) {
          const parsed = z
            .string()
            .refine((v) => validOptions.includes(v), {
              message: `Must be one of: ${validOptions.join(", ")}`,
            })
            .parse(value);
          return { success: true, data: parsed };
        }
        const parsed = z.string().parse(value);
        return { success: true, data: parsed };
      }
      case "json": {
        const str = z.string().parse(value);
        try {
          JSON.parse(str);
        } catch {
          return { success: false, error: "Invalid JSON" };
        }
        return { success: true, data: str };
      }
      default:
        return { success: true, data: value };
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.issues[0]?.message ?? "Invalid value" };
    }
    return { success: false, error: "Invalid value" };
  }
}
