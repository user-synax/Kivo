import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import * as linkPreviewController from "./link-preview.controller.js";

const router = Router();

// All preview routes require authentication.
router.use(authenticate);

// Fetching + parsing arbitrary pages is heavier than a DB query, so cap at
// 30 previews/minute per user. The service also caches per URL for 1h.
const previewLimiter = rateLimiter({
  keyPrefix: "link-preview",
  windowSeconds: 60,
  max: 30,
});

router.get("/", previewLimiter, linkPreviewController.preview);

export default router;
