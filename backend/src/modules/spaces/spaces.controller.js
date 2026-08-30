import multer from "multer";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseBody } from "./spaces.validation.js";
import {
  createSpaceSchema,
  updateSpaceSchema,
  memberRoleSchema,
  createChannelSchema,
  updateChannelSchema,
} from "./spaces.validation.js";
import * as svc from "./spaces.service.js";

const upload = multer({
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only images allowed"));
    cb(null, true);
  },
}).single("avatar");

function withAvatar(handler) {
  return (req, res, next) => {
    upload(req, res, async (err) => {
      if (err) return res.status(400).json({ success: false, error: { message: err.message, code: "UPLOAD_ERROR" } });
      try {
        await handler(req, res);
      } catch (e) {
        next(e);
      }
    });
  };
}

export const createSpace = withAvatar(
  asyncHandler(async (req, res) => {
    const data = parseBody(createSpaceSchema, req.body);
    const avatar = req.file ? { buffer: req.file.buffer, contentType: req.file.mimetype } : null;
    const space = await svc.createSpace({ userId: req.user.userId, ...data, avatar });
    res.status(201).json({ success: true, data: space });
  })
);

export const listMySpaces = asyncHandler(async (req, res) => {
  const spaces = await svc.listSpaces({ userId: req.user.userId });
  res.json({ success: true, data: spaces });
});

export const listPublicSpaces = asyncHandler(async (req, res) => {
  const { q, category, limit } = req.query;
  const spaces = await svc.listPublicSpaces({ q, category, limit: limit ? Number(limit) : 20 });
  res.json({ success: true, data: spaces });
});

export const getSpace = asyncHandler(async (req, res) => {
  const space = await svc.getSpace({ spaceId: req.params.id, userId: req.user.userId });
  res.json({ success: true, data: space });
});

export const updateSpace = withAvatar(
  asyncHandler(async (req, res) => {
    const data = parseBody(updateSpaceSchema, req.body);
    const avatar = req.file ? { buffer: req.file.buffer, contentType: req.file.mimetype } : null;
    const space = await svc.updateSpace({ spaceId: req.params.id, userId: req.user.userId, data, avatar });
    res.json({ success: true, data: space });
  })
);

export const deleteSpace = asyncHandler(async (req, res) => {
  const r = await svc.deleteSpace({ spaceId: req.params.id, userId: req.user.userId });
  res.json({ success: true, data: r });
});

export const addMember = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) throw Object.assign(new Error("userId required"), { statusCode: 400 });
  const space = await svc.addMember({ spaceId: req.params.id, userId: req.user.userId, targetUserId: userId });
  res.json({ success: true, data: space });
});

export const removeMember = asyncHandler(async (req, res) => {
  const space = await svc.removeMember({ spaceId: req.params.id, userId: req.user.userId, targetUserId: req.params.userId });
  res.json({ success: true, data: space });
});

export const updateMemberRole = asyncHandler(async (req, res) => {
  const data = parseBody(memberRoleSchema, req.body);
  const space = await svc.updateMemberRole({ spaceId: req.params.id, userId: req.user.userId, targetUserId: req.params.userId, role: data.role });
  res.json({ success: true, data: space });
});

export const joinSpace = asyncHandler(async (req, res) => {
  const space = await svc.joinSpace({ spaceId: req.params.id, userId: req.user.userId });
  res.json({ success: true, data: space });
});

export const joinByInvite = asyncHandler(async (req, res) => {
  const space = await svc.joinByInvite({ code: req.params.code, userId: req.user.userId });
  res.json({ success: true, data: space });
});

export const createChannel = asyncHandler(async (req, res) => {
  const data = parseBody(createChannelSchema, req.body);
  const r = await svc.createChannel({ spaceId: req.params.id, userId: req.user.userId, ...data });
  res.status(201).json({ success: true, data: r });
});

export const listChannels = asyncHandler(async (req, res) => {
  const channels = await svc.listChannels({ spaceId: req.params.id, userId: req.user.userId });
  res.json({ success: true, data: channels });
});

export const updateChannel = asyncHandler(async (req, res) => {
  const data = parseBody(updateChannelSchema, req.body);
  const space = await svc.updateChannel({ spaceId: req.params.id, channelId: req.params.channelId, userId: req.user.userId, data });
  res.json({ success: true, data: space });
});

export const deleteChannel = asyncHandler(async (req, res) => {
  const space = await svc.deleteChannel({ spaceId: req.params.id, channelId: req.params.channelId, userId: req.user.userId });
  res.json({ success: true, data: space });
});
