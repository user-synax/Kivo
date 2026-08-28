import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseBody, createConversationSchema } from "./conversations.validation.js";
import * as conversationsService from "./conversations.service.js";

export const createConversation = asyncHandler(async (req, res) => {
  const { participantId } = parseBody(createConversationSchema, req.body);
  const conversation = await conversationsService.createOrGetDm({
    userId: req.user.userId,
    participantId,
  });
  res.status(201).json({ success: true, data: conversation });
});

export const listConversations = asyncHandler(async (req, res) => {
  const conversations = await conversationsService.listConversations({
    userId: req.user.userId,
  });
  res.status(200).json({ success: true, data: conversations });
});
