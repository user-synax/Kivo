import { asyncHandler } from "../../utils/asyncHandler.js";
import * as linkPreviewService from "./link-preview.service.js";

export const preview = asyncHandler(async (req, res) => {
  const url = req.query?.url;
  if (!url || typeof url !== "string" || !url.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_URL", message: "A ?url= query param is required" },
    });
  }
  const data = await linkPreviewService.fetchLinkPreview(url.trim());
  res.status(200).json({ success: true, data });
});
