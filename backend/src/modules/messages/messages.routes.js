import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import * as messagesController from "./messages.controller.js";

const router = Router();

// Single-message operations, mounted at /api/v1/messages. Edit/delete are
// restricted to the sender; reactions operate on the message id directly.
// Membership is re-checked server-side in the service layer for every call.
router.use(authenticate);

// Per-user limiters keyed by userId (default userKey). Edit and reactions are
// cheaper than sends but still capped to prevent abuse loops.
const messageEditLimiter = rateLimiter({
  keyPrefix: "message-edit",
  windowSeconds: 60,
  max: 20,
});
const reactionLimiter = rateLimiter({
  keyPrefix: "message-reaction",
  windowSeconds: 60,
  max: 60,
});

router.patch("/:id", messageEditLimiter, messagesController.editMessage);
router.delete("/:id", messagesController.deleteMessage);
router.post("/:id/reactions", reactionLimiter, messagesController.addReaction);
router.delete("/:id/reactions/:reactionId", reactionLimiter, messagesController.removeReaction);

export default router;
