import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseBody, parseQuery, listNotificationsQuerySchema, markReadSchema } from "./notifications.validation.js";
import * as notificationsService from "./notifications.service.js";

export const listNotifications = asyncHandler(async (req, res) => {
  const { cursor, limit, unreadOnly } = parseQuery(listNotificationsQuerySchema, req.query);
  const result = await notificationsService.listNotifications({
    userId: req.user.userId,
    cursor,
    limit,
    unreadOnly: Boolean(unreadOnly),
  });
  res.status(200).json({ success: true, data: result });
});

export const getUnreadCount = asyncHandler(async (req, res) => {
  const result = await notificationsService.unreadCount({ userId: req.user.userId });
  res.status(200).json({ success: true, data: result });
});

export const markRead = asyncHandler(async (req, res) => {
  const { ids, all } = parseBody(markReadSchema, req.body);
  const result = await notificationsService.markRead({
    userId: req.user.userId,
    ids,
    all,
  });
  res.status(200).json({ success: true, data: result });
});
