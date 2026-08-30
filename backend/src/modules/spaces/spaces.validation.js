import { z } from "zod";
import { SPACE_CATEGORIES } from "../../models/Space.js";

export const createSpaceSchema = z.object({
  name: z.string().trim().min(2).max(50),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  category: z.enum(SPACE_CATEGORIES).optional(),
  banner: z.string().trim().max(2000).nullable().optional().or(z.literal("")),
});

export const updateSpaceSchema = z.object({
  name: z.string().trim().min(2).max(50).optional(),
  description: z.string().trim().max(500).optional(),
  category: z.enum(SPACE_CATEGORIES).optional(),
  banner: z.string().trim().max(2000).nullable().optional().or(z.literal("")),
});

export const memberRoleSchema = z.object({
  role: z.enum(["admin", "moderator", "member"]),
});

export const createChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9-]+$/, "Use lowercase, numbers and hyphens only"),
  description: z.string().trim().max(280).optional().or(z.literal("")),
  type: z.enum(["text", "announcement"]).optional(),
});

export const updateChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9-]+$/, "Use lowercase, numbers and hyphens only")
    .optional(),
  description: z.string().trim().max(280).optional(),
  type: z.enum(["text", "announcement"]).optional(),
});

export function parseBody(schema, body) {
  const r = schema.safeParse(body);
  if (!r.success) {
    const e = new Error(r.error.issues[0]?.message || "Validation failed");
    e.statusCode = 400;
    e.code = "VALIDATION_ERROR";
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
