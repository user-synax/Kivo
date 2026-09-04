import { Router } from "express";
import { authenticate, authenticateOptional } from "../../middleware/auth.js";
import * as usersController from "./users.controller.js";

const router = Router();

// Public profile by username — the shareable /u/:username page. OPTIONAL auth:
// anonymous visitors (and search engines) can read a public profile; a valid
// Bearer token additionally enriches it with relationship/block state.
// Must be registered before router.use(authenticate) below.
router.get(
  "/:username/profile",
  authenticateOptional,
  usersController.getProfileByUsername,
);

// User discovery for the "add friend" UI. Requires auth.
router.use(authenticate);
router.get("/me", usersController.getMe);
router.patch("/me", usersController.updateMe);
router.patch("/me/avatar", usersController.updateAvatar);
router.delete("/me/avatar", usersController.deleteAvatar);
router.patch("/me/banner", usersController.updateBanner);
router.get("/search", usersController.search);
router.get("/blocked", usersController.listBlocked);
router.post("/:id/block", usersController.blockUser);
router.post("/:id/unblock", usersController.unblockUser);
router.get("/:id", usersController.getUserById);

export default router;
