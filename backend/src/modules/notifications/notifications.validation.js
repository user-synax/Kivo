import { z } from "zod";

export const listNotificationsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z
    .preprocess(
      (v) => {
        if (v === "true") return true;
        if (v === "false") return false;
        return v;
      },
      z.boolean().optional()
    )
    .optional(),
});

export const markReadSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).optional(),
    all: z.boolean().optional(),
  })
  .refine((data) => data.ids !== undefined || data.all === true, {
    message: "Provide ids[] or all:true",
  });

export const updatePreferencesSchema = z
  .object({
    directMessages: z.boolean().optional(),
    groupMessages: z.boolean().optional(),
    mentions: z.boolean().optional(),
    friendRequests: z.boolean().optional(),
    spaceMessages: z.boolean().optional(),
    announcements: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one preference field required",
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
