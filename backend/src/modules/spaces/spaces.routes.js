import { Router } from "express";
import { authenticate as auth } from "../../middleware/auth.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import * as ctrl from "./spaces.controller.js";

const router = Router();

router.use(auth);

// Per-user limiter for space/channel creation spam — 10 creations/hour per
// user (shared bucket for spaces and channels to cap total creation burst).
const spaceCreateLimiter = rateLimiter({
  keyPrefix: "space-create",
  windowSeconds: 3600,
  max: 10,
});

router.post("/", spaceCreateLimiter, ctrl.createSpace);
router.get("/", ctrl.listMySpaces);
router.get("/discover", ctrl.listPublicSpaces);
router.post("/join/:code", ctrl.joinByInvite);

router.get("/:id", ctrl.getSpace);
router.patch("/:id", ctrl.updateSpace);
router.delete("/:id", ctrl.deleteSpace);

router.post("/:id/join", ctrl.joinSpace);

router.post("/:id/members", ctrl.addMember);
router.delete("/:id/members/:userId", ctrl.removeMember);
router.patch("/:id/members/:userId/role", ctrl.updateMemberRole);

router.post("/:id/channels", spaceCreateLimiter, ctrl.createChannel);
router.get("/:id/channels", ctrl.listChannels);
router.patch("/:id/channels/:channelId", ctrl.updateChannel);
router.delete("/:id/channels/:channelId", ctrl.deleteChannel);

export default router;
