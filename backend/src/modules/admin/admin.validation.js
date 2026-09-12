import { z } from "zod";

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  banned: z.enum(["true", "false"]).optional(),
});

export const banUserBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const setUserPlanBodySchema = z.object({
  plan: z.enum(["free", "plus"]),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const objectIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid user id"),
});

export function parseBody(schema, body) {
  const result = schema.safeParse(body ?? {});
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
  const result = schema.safeParse(query ?? {});
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

export function parseParams(schema, params) {
  const result = schema.safeParse(params ?? {});
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
