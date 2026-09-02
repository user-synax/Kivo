import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  parseBody,
  parseQuery,
  createMessageSchema,
  updateMessageSchema,
  reactionSchema,
  listMessagesQuerySchema,
  markUnreadSchema,
} from "./messages.validation.js";
import * as messagesService from "./messages.service.js";

export const listMessages = asyncHandler(async (req, res) => {
  const { cursor, around, after, limit } = parseQuery(listMessagesQuerySchema, req.query);
  const result = await messagesService.listMessages({
    conversationId: req.params.id,
    userId: req.user.userId,
    cursor,
    around,
    after,
    limit,
  });
  res.status(200).json({ success: true, data: result });
});

export const createMessage = asyncHandler(async (req, res) => {
  const { content, replyToMessageId, attachments } = parseBody(createMessageSchema, req.body);
  const message = await messagesService.createMessage({
    conversationId: req.params.id,
    userId: req.user.userId,
    content,
    replyToMessageId,
    attachments,
  });
  res.status(201).json({ success: true, data: message });
});

export const editMessage = asyncHandler(async (req, res) => {
  const { content } = parseBody(updateMessageSchema, req.body);
  const message = await messagesService.editMessage({
    messageId: req.params.id,
    userId: req.user.userId,
    content,
  });
  res.status(200).json({ success: true, data: message });
});

export const deleteMessage = asyncHandler(async (req, res) => {
  const message = await messagesService.deleteMessage({
    messageId: req.params.id,
    userId: req.user.userId,
  });
  res.status(200).json({ success: true, data: message });
});

export const addReaction = asyncHandler(async (req, res) => {
  const { emoji } = parseBody(reactionSchema, req.body);
  const reactions = await messagesService.toggleReaction({
    messageId: req.params.id,
    userId: req.user.userId,
    emoji,
  });
  res.status(200).json({ success: true, data: { messageId: req.params.id, reactions } });
});

export const removeReaction = asyncHandler(async (req, res) => {
  const reactions = await messagesService.removeReaction({
    messageId: req.params.id,
    userId: req.user.userId,
    reactionId: req.params.reactionId,
  });
  res.status(200).json({ success: true, data: { messageId: req.params.id, reactions } });
});

export const markRead = asyncHandler(async (req, res) => {
  const result = await messagesService.markRead({
    conversationId: req.params.id,
    userId: req.user.userId,
    upToMessageId: req.body?.upToMessageId,
  });
  res.status(200).json({ success: true, data: result });
});

export const markUnread = asyncHandler(async (req, res) => {
  const { messageId } = parseBody(markUnreadSchema, req.body || {});
  const result = await messagesService.markUnread({
    conversationId: req.params.id,
    userId: req.user.userId,
    messageId,
  });
  res.status(200).json({ success: true, data: result });
});
