import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import * as friendsController from "./friends.controller.js";

const router = Router();

// All friend endpoints require a valid access token.
router.use(authenticate);

router.post("/request", friendsController.sendRequest);
router.get("/requests", friendsController.listRequests);
router.post("/requests/:id/accept", friendsController.acceptRequest);
router.post("/requests/:id/decline", friendsController.declineRequest);
router.get("/", friendsController.listFriends);
router.delete("/:id", friendsController.removeFriend);

export default router;
