import { z } from "zod";

// Join token for a LiveKit call room. `conversationId` must be a DM or group
// the caller belongs to (space channels are rejected server-side — calls live
// in DMs/groups for v1). `kind` picks the initial media; voice can upgrade to
// video mid-call without a new token.
export const callTokenSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
  kind: z.enum(["voice", "video"]).default("voice"),
});

// `GET /status?conversationId=` — ongoing-call lookup for the Join pill.
export const callStatusQuerySchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
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

export function parseQuery(schema, query) {
  const result = schema.safeParse(query);
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
