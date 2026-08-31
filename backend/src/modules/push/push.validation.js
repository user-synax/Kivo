import { z } from "zod";

export const subscribeSchema = z.object({
  endpoint: z.string().min(1, "endpoint is required").url("endpoint must be a valid URL"),
  keys: z.object({
    p256dh: z.string().min(1, "p256dh is required"),
    auth: z.string().min(1, "auth is required"),
  }),
  expirationTime: z.coerce.date().nullable().optional(),
});

export const unsubscribeSchema = z.object({
  endpoint: z.string().min(1, "endpoint is required").url("endpoint must be a valid URL"),
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
