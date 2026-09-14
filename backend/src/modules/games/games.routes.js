import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import * as gamesController from "./games.controller.js";

const router = Router();

// All Kivo Games endpoints require a valid access token; membership of the
// conversation is re-checked in the service layer for every call.
router.use(authenticate);

// Invites are user-visible and create DMs, so they are capped tighter than the
// ordinary lifecycle actions.
const gameInviteLimiter = rateLimiter({
  keyPrefix: "game-invite",
  windowSeconds: 60,
  max: 10,
});
// Progress pings are frequent by design (a racer reports as they type).
const gameProgressLimiter = rateLimiter({
  keyPrefix: "game-progress",
  windowSeconds: 60,
  max: 120,
});
// Join/decline/start/finish/cancel are discrete lifecycle actions.
const gameActionLimiter = rateLimiter({
  keyPrefix: "game-action",
  windowSeconds: 60,
  max: 30,
});

// Static paths MUST come before "/:id" or Express would match them as ids.
router.get("/invites", gamesController.listInvites);
router.get("/mine", gamesController.listMyGames);
router.get("/series/:seriesId", gamesController.getSeries);
router.get("/leaderboard", gamesController.getLeaderboard);
router.post("/invite", gameInviteLimiter, gamesController.inviteGame);
router.post("/practice", gameInviteLimiter, gamesController.startPractice);

router.get("/:id", gamesController.getGame);
router.post("/:id/join", gameActionLimiter, gamesController.joinGame);
router.post("/:id/decline", gameActionLimiter, gamesController.declineGame);
router.post("/:id/start", gameActionLimiter, gamesController.startGame);
router.post("/:id/progress", gameProgressLimiter, gamesController.reportProgress);
router.post("/:id/finish", gameActionLimiter, gamesController.finishGame);
router.post("/:id/cancel", gameActionLimiter, gamesController.cancelGame);
router.post("/:id/rematch", gameActionLimiter, gamesController.rematchGame);
router.get("/:id/moves", gamesController.chessMoves);
router.post("/:id/move", gameActionLimiter, gamesController.playChessMove);
router.post("/:id/resign", gameActionLimiter, gamesController.resignChessGame);

export default router;
