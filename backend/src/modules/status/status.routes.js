import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import * as ctrl from "./status.controller.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 1 },
});

const router = Router();
router.use(authenticate);
router.post(
  "/",
  rateLimiter({ windowSeconds: 24 * 60 * 60, max: 10, keyPrefix: "status-create" }),
  upload.single("media"),
  ctrl.create,
);
router.get(
  "/feed",
  rateLimiter({ windowSeconds: 60, max: 30, keyPrefix: "status-feed" }),
  ctrl.feed,
);
router.get("/me", ctrl.myStatuses);
router.post(
  "/:id/view",
  rateLimiter({ windowSeconds: 60, max: 60, keyPrefix: "status-view" }),
  ctrl.view,
);
router.delete("/:id", ctrl.remove);
export default router;
