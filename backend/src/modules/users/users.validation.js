import { z } from "zod";

// Allowed avatar border customization ids. The client maps these to actual
// colors/gradients; we only store the id and validate it server-side.
export const AVATAR_STYLE_IDS = [
  "default",
  "lime",
  "blue",
  "rose",
  "amber",
  "violet",
  "ocean",
  "grad-sunset",
  "grad-aurora",
];

export const searchQuerySchema = z.object({
  q: z.string().trim().max(50).optional(),
});

// Self-service profile update. All fields optional (partial update).
export const updateMeSchema = z.object({
  displayName: z.string().trim().max(50).optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers and underscores")
    .optional()
    .or(z.literal("")),
  bio: z.string().trim().max(280).optional(),
  status: z.string().trim().max(60).optional(),
  avatarStyle: z.enum(AVATAR_STYLE_IDS).nullable().optional(),
  banner: z.string().trim().max(2000).nullable().optional().or(z.literal("")),
});

// Convenience parsers that throw a VALIDATION_ERROR ApiError on failure.
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

export function parseQuery(schema, query) {
  const result = schema.safeParse(query);
  if (!result.success) {
    const first = result.error.issues[0];
    const err = new Error(first?.message || "Validation failed");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return result.data;
}
