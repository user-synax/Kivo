import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/auth.js";
import * as attachmentsController from "./attachments.controller.js";

const router = Router();
router.use(authenticate);

// Memory storage — files live in buffers, written to Appwrite directly.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 10 },
});

router.post("/upload", upload.array("files", 10), attachmentsController.uploadFiles);

export default router;
