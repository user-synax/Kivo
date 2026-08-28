import { z } from "zod";

export const sendRequestSchema = z.object({
  // The target user, identified by username or email (case-insensitive).
  identifier: z.string().trim().min(1, "identifier is required").max(120),
});

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
