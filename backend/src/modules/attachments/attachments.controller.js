import { asyncHandler } from "../../utils/asyncHandler.js";
import { z } from "zod";
import { badRequest, forbidden, notFound } from "../../utils/errors.js";
import Conversation from "../../models/Conversation.js";
import User from "../../models/User.js";
import { getRequesterPlan } from "../../lib/plus.js";
import { uploadAttachment, ALLOWED_MIMES } from "../../lib/attachments.js";

const uploadBodySchema = z.object({
  conversationId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid conversation id"),
});

/**
 * POST /api/v1/attachments/upload
 * Body: multipart/form-data with `files` (1-10 files) + `conversationId`
 * Returns: { files: [{ fileId, bucketId, fileName, mimeType, size, kind, url }] }
 */
export const uploadFiles = asyncHandler(async (req, res) => {
  const parsed = uploadBodySchema.safeParse(req.body || {});
  if (!parsed.success) {
    throw badRequest(
      parsed.error.issues[0]?.message || "Invalid conversation id",
      "INVALID_CONVERSATION",
    );
  }
  const { conversationId } = parsed.data;

  // Verify conversation membership (reuses the same check as message send)
  const conversation = await Conversation.findById(conversationId).select("participants");
  if (!conversation) {
    throw notFound("Conversation not found", "CONVERSATION_NOT_FOUND");
  }
  const participantIds = conversation.participants.map((p) => p.toString());
  if (!participantIds.includes(req.user.userId)) {
    throw forbidden("Not a participant", "NOT_PARTICIPANT");
  }

  const files = req.files;
  if (!files || files.length === 0) {
    throw badRequest("At least one file is required", "NO_FILES");
  }
  // Per-plan caps (server-side, never trust the client). Free keeps today's
  // 30MB × 10 behavior; Plus gets 100MB × 20.
  const { plan, limits } = await getRequesterPlan(User, req.user.userId);
  if (files.length > limits.attachmentsPerMessage) {
    if (plan !== "plus") {
      throw forbidden(
        `Free plan allows up to ${limits.attachmentsPerMessage} files per message — upgrade to Kivo Plus for ${limits.attachmentsPerMessage} (Plus: 20)`,
        "PLUS_REQUIRED",
      );
    }
    throw badRequest(
      `Maximum ${limits.attachmentsPerMessage} files per message`,
      "TOO_MANY_FILES",
    );
  }

  const results = [];
  for (const file of files) {
    // Validate MIME type
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      throw badRequest(
        `File type "${file.mimetype}" is not allowed. Allowed: images (jpg, png, gif, webp), documents (pdf, doc, docx, xlsx, xls, ppt, pptx, txt), and audio (webm, ogg, mp3, m4a, aac, wav)`,
        "INVALID_FILE_TYPE",
      );
    }
    // Validate size against the caller's plan (multer already caps at Plus max).
    if (file.size > limits.attachmentMaxBytes) {
      if (plan !== "plus") {
        throw forbidden(
          `File "${file.originalname}" exceeds the free ${(limits.attachmentMaxBytes / 1024 / 1024).toFixed(0)}MB limit — upgrade to Kivo Plus for 100MB uploads`,
          "PLUS_REQUIRED",
        );
      }
      throw badRequest(
        `File "${file.originalname}" exceeds ${(limits.attachmentMaxBytes / 1024 / 1024).toFixed(0)}MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
        "FILE_TOO_LARGE",
      );
    }

    try {
      const uploaded = await uploadAttachment(
        file.buffer,
        file.originalname,
        file.mimetype,
        file.size,
      );
      results.push(uploaded);
    } catch (err) {
      console.error("[attachments] upload failed for", file.originalname, err?.message);
      throw err;
    }
  }

  res.status(201).json({ success: true, data: { files: results } });
});
