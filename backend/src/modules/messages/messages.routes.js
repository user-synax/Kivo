import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import * as messagesController from "./messages.controller.js";

const router = Router();

// Single-message operations, mounted at /api/v1/messages. Edit/delete are
// restricted to the sender; reactions operate on the message id directly.
// Membership is re-checked server-side in the service layer for every call.
router.use(authenticate);

router.patch("/:id", messagesController.editMessage);
router.delete("/:id", messagesController.deleteMessage);
router.post("/:id/reactions", messagesController.addReaction);
router.delete("/:id/reactions/:reactionId", messagesController.removeReaction);

export default router;
