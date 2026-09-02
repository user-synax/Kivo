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
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 10 },
});

router.post("/upload", uploadLimiter, upload.array("files", 10), attachmentsController.uploadFiles);

export default router;
