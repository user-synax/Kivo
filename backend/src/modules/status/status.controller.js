import * as svc from "./status.service.js";
import { createStatusSchema, statusIdParamSchema } from "./status.validation.js";
import { getIO } from "../../socket/index.js";
import { uploadAttachment, STATUS_ALLOWED_MIMES, STATUS_MAX_FILE_SIZE, fileKind } from "../../lib/attachments.js";
import { badRequest } from "../../utils/errors.js";

export async function create(req, res, next) {
  try {
    // Text/background come as strings even when multipart; Zod will coerce via req.body
    const raw = {
      text: typeof req.body?.text === "string" ? req.body.text : "",
      background: typeof req.body?.background === "string" ? req.body.background : "default",
    };
    const parsed = createStatusSchema.parse(raw);
    const userId = req.user.userId || req.user.id;

    let media = null;
    const file = req.file;
    if (file) {
      if (!STATUS_ALLOWED_MIMES.has(file.mimetype)) {
        throw badRequest(`File type "${file.mimetype}" not allowed for status. Allowed: images (jpg, png, gif, webp)`, "INVALID_FILE_TYPE");
      }
      if (file.size > STATUS_MAX_FILE_SIZE) {
        throw badRequest(`File exceeds ${(STATUS_MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB limit`, "FILE_TOO_LARGE");
      }
      const uploaded = await uploadAttachment(file.buffer, file.originalname, file.mimetype, file.size);
      media = {
        fileId: uploaded.fileId,
        bucketId: uploaded.bucketId,
        url: uploaded.url,
        kind: "image",
        mimeType: file.mimetype,
        size: file.size,
        fileName: file.originalname,
      };
    }

    const doc = await svc.createStatus({ userId, text: parsed.text, background: parsed.background, media });
    const populated = await doc.populate("userId", "displayName username avatarUrl avatarStyle");
    const payload = {
      id: String(doc._id),
      userId: String(populated.userId._id || populated.userId),
      text: doc.text,
      background: doc.background,
      media: doc.media || null,
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt,
      user: populated.userId,
    };
    const io = getIO();
    if (io) io.emit("status:new", payload);
    res.status(201).json({ success: true, data: payload });
  } catch (e) { next(e); }
}

export async function feed(req, res, next) {
  try {
    const userId = req.user.userId || req.user.id;
    const data = await svc.listFeed({ currentUserId: userId });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function myStatuses(req, res, next) {
  try {
    const userId = req.user.userId || req.user.id;
    const data = await svc.listMyStatuses({ currentUserId: userId });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function view(req, res, next) {
  try {
    const { id } = statusIdParamSchema.parse(req.params);
    const userId = req.user.userId || req.user.id;
    const doc = await svc.viewStatus({ currentUserId: userId, statusId: id });
    const io = getIO();
    if (io) io.emit("status:viewed", { statusId: id, viewerId: userId });
    res.json({ success: true, data: { id: String(doc._id) } });
  } catch (e) { next(e); }
}

export async function remove(req, res, next) {
  try {
    const { id } = statusIdParamSchema.parse(req.params);
    const userId = req.user.userId || req.user.id;
    await svc.deleteStatus({ currentUserId: userId, statusId: id });
    const io = getIO();
    if (io) io.emit("status:deleted", { statusId: id, userId });
    res.json({ success: true, data: { ok: true } });
  } catch (e) { next(e); }
}
