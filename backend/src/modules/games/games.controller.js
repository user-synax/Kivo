import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseBody, typingRaceInviteSchema } from "./games.validation.js";
import * as gamesService from "./games.service.js";

export const inviteTypingRace = asyncHandler(async (req, res) => {
  const { conversationId } = parseBody(typingRaceInviteSchema, req.body);
  const result = await gamesService.createTypingRaceInvite({
    conversationId,
    userId: req.user.userId,
  });
  res.status(201).json({ success: true, data: result });
});

export const getMatch = asyncHandler(async (req, res) => {
  const match = await gamesService.getMatch(req.params.id);
  res.status(200).json({ success: true, data: match });
});

export const listMatches = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 20;
  const matches = await gamesService.listMatchesForUser({ userId: req.user.userId, limit });
  res.status(200).json({ success: true, data: matches });
});
