import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import * as ctrl from "./games.controller.js";

const router = Router();

router.use(authenticate);

router.get("/typing-race", ctrl.listMatches);
router.post("/typing-race/invite", ctrl.inviteTypingRace);
router.get("/typing-race/:id", ctrl.getMatch);

export default router;
