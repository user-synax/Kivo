import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import * as notificationsController from "./notifications.controller.js";

const router = Router();

// All notification routes require a valid access token.
router.use(authenticate);

router.get("/unread-count", notificationsController.getUnreadCount);
router.get("/", notificationsController.listNotifications);
router.patch("/read", notificationsController.markRead);

export default router;
