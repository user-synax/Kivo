import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseBody, subscribeSchema, unsubscribeSchema } from "./push.validation.js";
import * as pushService from "./push.service.js";
import env from "../../config/env.js";

export const getVapidPublicKey = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { publicKey: env.vapidPublicKey } });
});

export const subscribe = asyncHandler(async (req, res) => {
  const { endpoint, keys, expirationTime } = parseBody(subscribeSchema, req.body);
  const userAgent = req.headers["user-agent"] || null;
  const result = await pushService.subscribe({
    userId: req.user.userId,
    endpoint,
    keys,
    expirationTime: expirationTime || null,
    userAgent,
  });
  res.status(201).json({ success: true, data: result });
});

export const unsubscribe = asyncHandler(async (req, res) => {
  const { endpoint } = parseBody(unsubscribeSchema, req.body);
  const result = await pushService.unsubscribe({ userId: req.user.userId, endpoint });
  res.status(200).json({ success: true, data: result });
});
