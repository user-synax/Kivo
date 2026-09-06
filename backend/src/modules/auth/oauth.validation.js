import { z } from "zod";

export const providerParamSchema = z.object({
  provider: z.enum(["google", "github"]),
});

export function parseParams(schema, params) {
  const result = schema.safeParse(params);
  if (!result.success) {
    const first = result.error.issues[0];
    const err = new Error(first?.message || "Validation failed");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
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

export const callbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

// Optional query for GET /oauth/:provider start (used by the native app):
// - redirect_uri: provider redirect target (device-reachable backend callback
//   URL). Must share the configured callback path; the provider enforces its
//   own registration list.
// - return_to: where OUR callback redirects after (web callback page by
//   default, or the app deep link kivo://oauth/callback / Expo Go URL).
export const startQuerySchema = z.object({
  redirect_uri: z.string().max(500).optional(),
  return_to: z.string().max(500).optional(),
});
