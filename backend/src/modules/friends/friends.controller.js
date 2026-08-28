import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseBody, sendRequestSchema } from "./friends.validation.js";
import * as friendsService from "./friends.service.js";

export const sendRequest = asyncHandler(async (req, res) => {
  const { identifier } = parseBody(sendRequestSchema, req.body);
  const result = await friendsService.sendRequest({ userId: req.user.userId, identifier });
  res.status(result.alreadySent ? 200 : 201).json({ success: true, data: result.request });
});

export const listRequests = asyncHandler(async (req, res) => {
  const requests = await friendsService.listRequests({ userId: req.user.userId });
  res.status(200).json({ success: true, data: requests });
});

export const acceptRequest = asyncHandler(async (req, res) => {
  const result = await friendsService.acceptRequest({ userId: req.user.userId, requestId: req.params.id });
  res.status(200).json({ success: true, data: result });
});

export const declineRequest = asyncHandler(async (req, res) => {
  const result = await friendsService.declineRequest({ userId: req.user.userId, requestId: req.params.id });
  res.status(200).json({ success: true, data: result });
});

export const listFriends = asyncHandler(async (req, res) => {
  const friends = await friendsService.listFriends({ userId: req.user.userId });
  res.status(200).json({ success: true, data: friends });
});

export const removeFriend = asyncHandler(async (req, res) => {
  const result = await friendsService.removeFriend({ userId: req.user.userId, friendId: req.params.id });
  res.status(200).json({ success: true, data: result });
});
