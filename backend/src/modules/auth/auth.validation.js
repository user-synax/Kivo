import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Invalid email"),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username too long")
    .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers and underscores")
    .optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password too long"),
});

export const loginSchema = z.object({
  // Accepts either an email or a username.
  identifier: z.string().min(1, "Identifier is required"),
  password: z.string().min(1, "Password is required"),
});

// Convenience parser that throws a VALIDATION_ERROR ApiError on failure.
export function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    const err = new Error(first?.message || "Validation failed");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    err.issues = result.error.issues;
    throw err;
  }
  return result.data;
}
