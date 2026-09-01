import { asyncHandler } from "../../utils/asyncHandler.js";
import { badRequest, forbidden, notFound } from "../../utils/errors.js";
import Conversation from "../../models/Conversation.js";
import { uploadAttachment, ALLOWED_MIMES, MAX_FILE_SIZE } from "../../lib/attachments.js";

/**
 * POST /api/v1/attachments/upload
 * Body: multipart/form-data with `files` (1-10 files) + `conversationId`
 * Returns: { files: [{ fileId, bucketId, fileName, mimeType, size, kind, url }] }
 */
export const uploadFiles = asyncHandler(async (req, res) => {
  const { conversationId } = req.body;
  if (!conversationId) {
    throw badRequest("conversationId is required", "MISSING_CONVERSATION_ID");
  }

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
  if (files.length > 10) {
    throw badRequest("Maximum 10 files per message", "TOO_MANY_FILES");
  }

  const results = [];
  for (const file of files) {
    // Validate MIME type
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      throw badRequest(
        `File type "${file.mimetype}" is not allowed. Allowed: images (jpg, png, gif, webp) and documents (pdf, doc, docx, xlsx, xls, ppt, pptx, txt)`,
        "INVALID_FILE_TYPE",
      );
    }
    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      throw badRequest(
        `File "${file.originalname}" exceeds 30MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
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
