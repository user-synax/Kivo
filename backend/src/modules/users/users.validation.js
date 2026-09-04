import { z } from "zod";

// Allowed avatar border customization ids. The client maps these to actual
// colors/gradients; we only store the id and validate it server-side.
export const AVATAR_STYLE_IDS = [
  "default",
  "accent",
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

// Kivo Plus profile-effect ids ("glow" avatar halo, "gradient-name", or
// "aura" = both). Only meaningful for plus-plan users; free users are forced
// back to "none" server-side.
export const PROFILE_EFFECT_IDS = [
  "none",
  "glow",
  "gradient-name",
  "aura",
];

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
  profileEffect: z.enum(PROFILE_EFFECT_IDS).nullable().optional(),
  // `plan` is deliberately NOT accepted here — tiers are admin-granted only.
  banner: z.string().trim().max(2000).nullable().optional().or(z.literal("")),
  country: z
    .string()
    .trim()
    .max(2)
    .regex(/^[A-Z]{2}$/, "Country must be a 2-letter ISO code (e.g. US, IN)")
    .nullable()
    .optional()
    .or(z.literal("")),
  githubUsername: z
    .string()
    .trim()
    .max(39)
    .regex(/^[a-zA-Z0-9-]*$/, "GitHub username may only contain letters, numbers, and hyphens")
    .nullable()
    .optional()
    .or(z.literal("")),
  xUsername: z
    .string()
    .trim()
    .max(60)
    .regex(/^[a-zA-Z0-9_]*$/, "X username may only contain letters, numbers, and underscores")
    .nullable()
    .optional()
    .or(z.literal("")),
  instagramUsername: z
    .string()
    .trim()
    .max(60)
    .regex(/^[a-zA-Z0-9_.]*$/, "Instagram username may only contain letters, numbers, dots, and underscores")
    .nullable()
    .optional()
    .or(z.literal("")),
  // YouTube/website links accept full URLs only — must start with a scheme so
  // the client can link out safely (no javascript:/etc).
  youtubeUrl: z
    .string()
    .trim()
    .max(500)
    .regex(/^https?:\/\//i, "YouTube link must start with http:// or https://")
    .nullable()
    .optional()
    .or(z.literal("")),
  websiteUrl: z
    .string()
    .trim()
    .max(500)
    .regex(/^https?:\/\//i, "Website link must start with http:// or https://")
    .nullable()
    .optional()
    .or(z.literal("")),
  showBadge: z.boolean().optional(),

  // Per-user appearance customization (theme studio + chat look). Colors are
  // optional 6-digit hex codes; wallpaper/bubbleStyle are enum ids; a null
  // value (or null object) clears the customization and falls back to the
  // preset theme's own values.
  appearance: z
    .object({
      accent: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a 6-digit hex code (e.g. #ff5500)")
        .nullable()
        .optional(),
      tint: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a 6-digit hex code (e.g. #ff5500)")
        .nullable()
        .optional(),
      wallpaper: z
        .enum(["none", "dots", "grid", "diagonal", "bubbles", "wash"])
        .nullable()
        .optional(),
      bubbleStyle: z
        .enum(["rounded", "pill", "squared", "outline"])
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
});

export const usernameParamSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers and underscores"),
});

export function parseParams(schema, params) {
  const result = schema.safeParse(params);
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
