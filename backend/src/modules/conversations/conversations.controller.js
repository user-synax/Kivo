import multer from "multer";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  parseBody,
  createConversationSchema,
  createGroupSchema,
  updateGroupSchema,
  addMembersSchema,
} from "./conversations.validation.js";
import * as conversationsService from "./conversations.service.js";

// Group avatar upload — single image field "avatar", max 4MB, image types only.
// Mirrors the user avatar upload in the users module.
const ALLOWED_AVATAR_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const uploadGroupAvatarMulter = multer({
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_AVATAR_TYPES.has(file.mimetype)) {
      cb(new Error("Unsupported image type"));
      return;
    }
    cb(null, true);
  },
}).single("avatar");

// Run multer and translate its errors into a 400 ApiError-style response.
function groupAvatarUpload(req, res, next) {
  uploadGroupAvatarMulter(req, res, (err) => {
    if (err) {
      const e = new Error(err.message || "Upload failed");
      e.statusCode = 400;
      e.code = "UPLOAD_ERROR";
      return next(e);
    }
    next();
  });
}

export const createConversation = asyncHandler(async (req, res) => {
  const { participantId } = parseBody(createConversationSchema, req.body);
  const conversation = await conversationsService.createOrGetDm({
    userId: req.user.userId,
    participantId,
  });
  res.status(201).json({ success: true, data: conversation });
});

export const listConversations = asyncHandler(async (req, res) => {
  const conversations = await conversationsService.listConversations({
    userId: req.user.userId,
  });
  res.status(200).json({ success: true, data: conversations });
});

// Create a group. Accepts multipart form data: `name`, `participantIds` (a JSON
// array string), and an optional `avatar` file.
export const createGroup = [
  groupAvatarUpload,
  asyncHandler(async (req, res) => {
    const participantIds =
      typeof req.body.participantIds === "string"
        ? JSON.parse(req.body.participantIds)
        : req.body.participantIds;
    const { name } = parseBody(createGroupSchema, {
      name: req.body.name,
      participantIds,
    });
    const avatar = req.file
      ? { buffer: req.file.buffer, contentType: req.file.mimetype }
      : null;
    const conversation = await conversationsService.createGroup({
      userId: req.user.userId,
      name,
      participantIds,
      avatar,
    });
    res.status(201).json({ success: true, data: conversation });
  }),
];

// Update a group's name and/or avatar. Admin only.
export const updateGroup = [
  groupAvatarUpload,
  asyncHandler(async (req, res) => {
    const { name } = parseBody(updateGroupSchema, { name: req.body.name });
    const avatar = req.file
      ? { buffer: req.file.buffer, contentType: req.file.mimetype }
      : null;
    const conversation = await conversationsService.updateGroup({
      conversationId: req.params.id,
      userId: req.user.userId,
      name,
      avatar,
    });
    res.status(200).json({ success: true, data: conversation });
  }),
];

// Add members to a group. Admin only.
export const addMembers = asyncHandler(async (req, res) => {
  const { memberIds } = parseBody(addMembersSchema, req.body);
  const conversation = await conversationsService.addMembers({
    conversationId: req.params.id,
    userId: req.user.userId,
    memberIds,
  });
  res.status(200).json({ success: true, data: conversation });
});

// Remove a member (or leave the group). Admin removes others; anyone removes
// themselves.
export const removeMember = asyncHandler(async (req, res) => {
  const conversation = await conversationsService.removeMember({
    conversationId: req.params.id,
    userId: req.user.userId,
    targetUserId: req.params.userId,
  });
  res.status(200).json({ success: true, data: conversation });
});

// Promote a member to admin. Admin only.
export const promoteMember = asyncHandler(async (req, res) => {
  const conversation = await conversationsService.promoteMember({
    conversationId: req.params.id,
    userId: req.user.userId,
    targetUserId: req.params.userId,
  });
  res.status(200).json({ success: true, data: conversation });
});

// Demote an admin to a regular member. Admin only.
export const demoteMember = asyncHandler(async (req, res) => {
  const conversation = await conversationsService.demoteMember({
    conversationId: req.params.id,
    userId: req.user.userId,
    targetUserId: req.params.userId,
  });
  res.status(200).json({ success: true, data: conversation });
});
