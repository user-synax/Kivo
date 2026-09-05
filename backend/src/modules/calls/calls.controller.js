import { asyncHandler } from "../../utils/asyncHandler.js";
import env from "../../config/env.js";
import { callStatusQuerySchema, callTokenSchema, parseBody, parseQuery } from "./calls.validation.js";
import * as callsService from "./calls.service.js";

// Public capability flag (auth required — only rendered inside /app anyway).
// The LiveKit server URL is not a secret; tokens are minted per call below.
export const callsConfig = asyncHandler(async (req, res) => {
  const enabled = callsService.isCallsConfigured();
  res.status(200).json({
    success: true,
    data: { enabled, url: enabled ? env.livekitUrl : null },
  });
});

// Mint a short-lived LiveKit join token for a DM/group call room.
export const issueToken = asyncHandler(async (req, res) => {
  const { conversationId, kind } = parseBody(callTokenSchema, req.body);
  const call = await callsService.issueCallToken({
    userId: req.user.userId,
    conversationId,
    kind,
  });
  res.status(200).json({ success: true, data: call });
});

// Ongoing-call lookup (Join pill for late joiners).
export const callStatus = asyncHandler(async (req, res) => {
  const { conversationId } = parseQuery(callStatusQuerySchema, req.query);
  const status = await callsService.getCallStatus({
    userId: req.user.userId,
    conversationId,
  });
  res.status(200).json({ success: true, data: status });
});
