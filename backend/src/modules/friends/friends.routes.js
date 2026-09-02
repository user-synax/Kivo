import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import * as friendsController from "./friends.controller.js";

const router = Router();

// All friend endpoints require a valid access token.
router.use(authenticate);

// Per-user limiter for friend-request spam — 20 requests/hour per user.
const friendRequestLimiter = rateLimiter({
  keyPrefix: "friend-request",
  windowSeconds: 3600,
  max: 20,
});

router.post("/request", friendRequestLimiter, friendsController.sendRequest);
router.get("/requests", friendsController.listRequests);
router.post("/requests/:id/accept", friendsController.acceptRequest);
router.post("/requests/:id/decline", friendsController.declineRequest);
router.get("/", friendsController.listFriends);
router.delete("/:id", friendsController.removeFriend);

export default router;
