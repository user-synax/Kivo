import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseBody, claimSchema } from "./plus.validation.js";
import * as plusService from "./plus.service.js";

export const createClaim = asyncHandler(async (req, res) => {
  const { utr } = parseBody(claimSchema, req.body || {});
  const data = await plusService.createClaim({
    userId: req.user.userId,
    utr,
  });
  res.status(201).json({ success: true, data });
});

export const getMyClaim = asyncHandler(async (req, res) => {
  const data = await plusService.getMyClaim({ userId: req.user.userId });
  res.status(200).json({ success: true, data });
});
