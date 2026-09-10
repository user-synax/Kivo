import { z } from "zod";

export const createEmojiSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(32, "Name too long (max 32)")
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers and underscores only")
    .transform((s) => s.toLowerCase()),
  spaceId: z.string().nullable().optional(),
  personal: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => {
      if (v === true || v === "true" || v === "1") return true;
      return false;
    }),
});

export const listEmojiQuerySchema = z.object({
  spaceId: z.string().nullable().optional(),
  personal: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => {
      if (v === true || v === "true" || v === "1") return true;
      return false;
    }),
});

export function parseBody(schema, body) {
  const r = schema.safeParse(body);
  if (!r.success) {
    const e = new Error(r.error.issues[0]?.message || "Validation failed");
    e.statusCode = 400;
    e.code = "VALIDATION_ERROR";
    e.issues = r.error.issues;
    throw e;
  }
  return r.data;
}

export function parseQuery(schema, query) {
  const r = schema.safeParse(query);
  if (!r.success) {
    const e = new Error(r.error.issues[0]?.message || "Validation failed");
    e.statusCode = 400;
    e.code = "VALIDATION_ERROR";
    throw e;
  }
  return r.data;
}
