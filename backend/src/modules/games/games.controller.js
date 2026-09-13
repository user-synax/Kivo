import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  inviteGameSchema,
  practiceSchema,
  progressSchema,
  finishSchema,
  parseBody,
} from "./games.validation.js";
import * as gamesService from "./games.service.js";

// Kivo Games REST surface. Thin controllers: validate → delegate → respond.
// Every service call re-checks conversation membership server-side.

// Send a play invite from the arena. Creates (or reuses) the DM and posts the
// chat chip; the game itself is played at /games.
export const inviteGame = asyncHandler(async (req, res) => {
  const { targetUserId, kind } = parseBody(inviteGameSchema, req.body);
  const game = await gamesService.inviteToGame({
    userId: req.user.userId,
    targetUserId,
    kind,
  });
  res.status(201).json({ success: true, data: game });
});

// Arena: pending invites waiting on me.
export const listInvites = asyncHandler(async (req, res) => {
  const invites = await gamesService.listInvites({ userId: req.user.userId });
  res.status(200).json({ success: true, data: invites });
});

// Arena: games I am currently part of (waiting or racing).
export const listMyGames = asyncHandler(async (req, res) => {
  const games = await gamesService.listMyGames({ userId: req.user.userId });
  res.status(200).json({ success: true, data: games });
});

export const getGame = asyncHandler(async (req, res) => {
  const game = await gamesService.getGame({
    gameId: req.params.id,
    userId: req.user.userId,
  });
  res.status(200).json({ success: true, data: game });
});

export const joinGame = asyncHandler(async (req, res) => {
  const game = await gamesService.joinGame({
    gameId: req.params.id,
    userId: req.user.userId,
  });
  res.status(200).json({ success: true, data: game });
});

export const declineGame = asyncHandler(async (req, res) => {
  const game = await gamesService.declineGame({
    gameId: req.params.id,
    userId: req.user.userId,
  });
  res.status(200).json({ success: true, data: game });
});

export const startGame = asyncHandler(async (req, res) => {
  const game = await gamesService.startGame({
    gameId: req.params.id,
    userId: req.user.userId,
  });
  res.status(200).json({ success: true, data: game });
});

export const reportProgress = asyncHandler(async (req, res) => {
  const { progress } = parseBody(progressSchema, req.body);
  const result = await gamesService.reportProgress({
    gameId: req.params.id,
    userId: req.user.userId,
    progress,
  });
  res.status(200).json({ success: true, data: result });
});

export const finishGame = asyncHandler(async (req, res) => {
  const { accuracy, elapsedMs } = parseBody(finishSchema, req.body);
  const game = await gamesService.finishGame({
    gameId: req.params.id,
    userId: req.user.userId,
    accuracy,
    elapsedMs,
  });
  res.status(200).json({ success: true, data: game });
});

export const cancelGame = asyncHandler(async (req, res) => {
  const game = await gamesService.cancelGame({
    gameId: req.params.id,
    userId: req.user.userId,
  });
  res.status(200).json({ success: true, data: game });
});

// Rematch: one tap from a finished race creates Game N+1 in the same
// conversation, carrying the best-of series forward.
export const rematchGame = asyncHandler(async (req, res) => {
  const game = await gamesService.rematchGame({
    gameId: req.params.id,
    userId: req.user.userId,
  });
  res.status(201).json({ success: true, data: game });
});

// Solo practice vs bot. Born active — the response carries the passage so the
// arena can drop straight into the race view.
export const startPractice = asyncHandler(async (req, res) => {
  const { difficulty } = parseBody(practiceSchema, req.body);
  const game = await gamesService.startPractice({
    userId: req.user.userId,
    difficulty,
  });
  res.status(201).json({ success: true, data: game });
});

// Best-of series summary for a result screen.
export const getSeries = asyncHandler(async (req, res) => {
  const series = await gamesService.getSeries({
    seriesId: req.params.seriesId,
    userId: req.user.userId,
  });
  res.status(200).json({ success: true, data: series });
});
