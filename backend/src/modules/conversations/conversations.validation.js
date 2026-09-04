import { z } from "zod";

export const createConversationSchema = z.object({
  // The other user to start a DM with. Must be a valid user id (not self).
  participantId: z.string().min(1, "participantId is required"),
});

// Create a group. `participantIds` are the OTHER members (the creator is added
// automatically); at least 2 are required so the group has 3+ participants.
export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(50, "Name too long"),
  participantIds: z
    .array(z.string().min(1))
    .min(2, "Select at least 2 friends"),
});

// Rename a group. `avatar` is handled as a multipart file, not in this schema.
// `name` is optional so an avatar-only update is valid.
export const updateGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name cannot be empty").max(50, "Name too long").optional(),
});

// Shared chat look for a DM/group (wallpaper + bubble style). Null per field =
// fall back to each member's own look. Enum ids mirror the personal and Space
// look options.
export const conversationLookSchema = z.object({
  wallpaper: z
    .enum(["none", "dots", "grid", "diagonal", "bubbles", "wash"])
    .nullable()
    .optional(),
  bubbleStyle: z
    .enum(["rounded", "pill", "squared", "outline"])
    .nullable()
    .optional(),
});

// Add members to a group.
export const addMembersSchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1, "Select at least one member"),
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
