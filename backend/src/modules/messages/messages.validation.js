import { z } from "zod";

const attachmentSchema = z.object({
  fileId: z.string().min(1),
  bucketId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
  kind: z.enum(["image", "document"]),
  url: z.string().url(),
});

export const createMessageSchema = z.object({
  content: z.string().trim().max(4000, "Message too long").optional(),
  replyToMessageId: z.string().optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
}).refine(
  (data) => (data.content && data.content.length > 0) || (data.attachments && data.attachments.length > 0),
  { message: "Message must have content or at least one attachment", path: ["content"] },
);

export const updateMessageSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty").max(4000, "Message too long"),
});

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(8, "Emoji too long"),
});

export const listMessagesQuerySchema = z.object({
  cursor: z.string().optional(),
  around: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
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
    throw err;
  }
  return result.data;
}
