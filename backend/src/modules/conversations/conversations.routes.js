import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import * as conversationsController from "./conversations.controller.js";
import * as messagesController from "../messages/messages.controller.js";

const router = Router();

// All conversation routes require a valid access token.
router.use(authenticate);

router.post("/", conversationsController.createConversation);
router.post("/group", conversationsController.createGroup);
router.get("/", conversationsController.listConversations);

// Conversation-scoped message endpoints live under the conversation id.
router.get("/:id/messages", messagesController.listMessages);
router.post("/:id/messages", messagesController.createMessage);
router.patch("/:id/read", messagesController.markRead);
router.post("/:id/unread", messagesController.markUnread);

// Group management (admin-restricted actions enforced in the service layer).
router.patch("/:id", conversationsController.updateGroup);
router.post("/:id/members", conversationsController.addMembers);
router.delete("/:id/members/:userId", conversationsController.removeMember);
router.post("/:id/admins/:userId", conversationsController.promoteMember);
router.delete("/:id/admins/:userId", conversationsController.demoteMember);

export default router;
