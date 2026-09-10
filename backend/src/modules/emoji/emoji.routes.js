import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import * as ctrl from "./emoji.controller.js";

const router = Router();

router.use(authenticate);

// Index: tiny JSON, 30/min
const listLimiter = rateLimiter({
  keyPrefix: "emoji-list",
  windowSeconds: 60,
  max: 30,
});

// Upload: 10/hour/user + per-Space cap in service
const uploadLimiter = rateLimiter({
  keyPrefix: "emoji-upload",
  windowSeconds: 3600,
  max: 10,
});

// Delete: 20/min
const deleteLimiter = rateLimiter({
  keyPrefix: "emoji-delete",
  windowSeconds: 60,
  max: 20,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 256 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype)) {
      const err = new Error(`File type "${file.mimetype}" not allowed. Allowed: png, jpeg, webp, gif`);
      err.statusCode = 400;
      err.code = "INVALID_FILE_TYPE";
      return cb(err);
    }
    cb(null, true);
  },
});

function withUpload(handler) {
  return (req, res, next) => {
    upload.single("image")(req, res, async (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ success: false, error: { code: "FILE_TOO_LARGE", message: "File too large (max 256 KB)" } });
        }
        const status = err.statusCode || 400;
        const code = err.code || "UPLOAD_ERROR";
        return res.status(status).json({ success: false, error: { code, message: err.message } });
      }
      try {
        await handler(req, res, next);
      } catch (e) {
        next(e);
      }
    });
  };
}

router.get("/", listLimiter, ctrl.listEmojis);
router.get("/personal", listLimiter, ctrl.listPersonal);
router.post("/", uploadLimiter, withUpload(ctrl.createEmoji));
router.delete("/:id", deleteLimiter, ctrl.deleteEmoji);

export default router;
