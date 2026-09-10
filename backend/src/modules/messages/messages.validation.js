import { z } from "zod";

const attachmentSchema = z.object({
  fileId: z.string().min(1),
  bucketId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
  kind: z.enum(["image", "document", "audio"]),
  url: z.string().url(),
});

const pollOptionInputSchema = z.string().trim().min(1, "Option cannot be empty").max(60, "Option too long");

const pollInputSchema = z.object({
  question: z.string().trim().min(1, "Question required").max(140, "Question too long (140 max)"),
  options: z
    .array(pollOptionInputSchema)
    .min(2, "At least 2 options")
    .max(8, "At most 8 options")
    .refine((arr) => new Set(arr.map((s) => s.trim().toLowerCase())).size === arr.length, {
      message: "Duplicate options",
      path: ["options"],
    }),
  allowMultiple: z.boolean().optional().default(false),
  anonymous: z.boolean().optional().default(false),
  expiresAt: z.string().datetime().nullable().optional().or(z.null()),
});

export const createMessageSchema = z
  .object({
    content: z.string().trim().max(8000, "Message too long").optional(),
    replyToMessageId: z.string().optional(),
    threadId: z.string().optional(),
    attachments: z.array(attachmentSchema).max(20).optional(),
    audioDuration: z.number().min(0).max(3600).optional(),
    forwardedFromId: z.string().optional(),
    scheduledAt: z
      .string()
      .datetime()
      .optional()
      .refine((v) => !v || new Date(v).getTime() > Date.now(), "scheduledAt must be future")
      .refine((v) => !v || new Date(v).getTime() - Date.now() <= 30 * 24 * 60 * 60 * 1000, "max 30 days"),
    poll: pollInputSchema.optional(),
  })
  .refine(
    (data) =>
      (data.content && data.content.length > 0) ||
      (data.attachments && data.attachments.length > 0) ||
      Boolean(data.forwardedFromId) ||
      Boolean(data.poll),
    {
      message: "Message must have content, an attachment, or a forwarded message or poll",
      path: ["content"],
    },
  )
  .refine((data) => !(data.poll && (data.attachments?.length || data.forwardedFromId || data.threadId)), {
    message: "Poll messages cannot carry attachments, forwards, or threadId",
    path: ["poll"],
  });

export const pollVoteSchema = z.object({
  optionIds: z.array(z.string().min(1)).min(1, "Pick at least one option").max(8),
});

export const updateMessageSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty").max(8000, "Message too long"),
});

export const reactionSchema = z.object({
  emoji: z
    .string()
    .min(1)
    .max(64, "Emoji too long")
    .refine(
      (v) => v.startsWith("custom:") || [...v].length <= 8,
      "Emoji too long"
    ),
});

export const pinSchema = z.object({
  pinned: z.boolean(),
});

export const saveSchema = z.object({
  saved: z.boolean(),
});

export const listMessagesQuerySchema = z.object({
  cursor: z.string().optional(),
  around: z.string().optional(),
  after: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const markUnreadSchema = z.object({
  messageId: z.string().optional(),
});

export const listScheduledSchema = z.object({ conversationId: z.string() });
export const editHistorySchema = z.object({ messageId: z.string() });

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
