import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import * as attachmentsController from "./attachments.controller.js";

const router = Router();
router.use(authenticate);

// Per-user limiter: each upload is up to 30MB × 10 files and hits Appwrite
// directly — highest-cost abuse vector, so capped at 10 uploads/minute.
const uploadLimiter = rateLimiter({
  keyPrefix: "attachment-upload",
  windowSeconds: 60,
  max: 10,
});

// Memory storage — files live in buffers, written to Appwrite directly.
// Multer caps at the PLUS maximum (100MB × 20); the controller then enforces
// the per-plan limit server-side (free is lower), so free users get a clean
// PLUS_REQUIRED-style error instead of a raw multer rejection.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 20 },
});

router.post("/upload", uploadLimiter, upload.array("files", 20), attachmentsController.uploadFiles);

export default router;
