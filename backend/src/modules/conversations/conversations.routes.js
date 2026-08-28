import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import * as conversationsController from "./conversations.controller.js";
import * as messagesController from "../messages/messages.controller.js";

const router = Router();

// All conversation routes require a valid access token.
router.use(authenticate);

router.post("/", conversationsController.createConversation);
router.get("/", conversationsController.listConversations);

// Conversation-scoped message endpoints live under the conversation id.
router.get("/:id/messages", messagesController.listMessages);
router.post("/:id/messages", messagesController.createMessage);
router.patch("/:id/read", messagesController.markRead);

export default router;
