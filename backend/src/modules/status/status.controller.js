import * as svc from "./status.service.js";
import { createStatusSchema, statusIdParamSchema } from "./status.validation.js";
import { getIO } from "../../socket/index.js";
import User from "../../models/User.js";

export async function create(req, res, next) {
  try {
    const parsed = createStatusSchema.parse(req.body);
    const userId = req.user.userId || req.user.id;
    const doc = await svc.createStatus({ userId, text: parsed.text, background: parsed.background });
    const populated = await doc.populate("userId", "displayName username avatarUrl avatarStyle");
    const payload = { id: String(doc._id), userId: String(populated.userId._id || populated.userId), text: doc.text, background: doc.background, createdAt: doc.createdAt, expiresAt: doc.expiresAt, user: populated.userId };
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
