import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import * as pushController from "./push.controller.js";

const router = Router();

// Public — no auth needed, used by the SW to fetch the VAPID key before subscribing
router.get("/vapid-public-key", pushController.getVapidPublicKey);

// All other push routes require a valid access token
router.use(authenticate);

router.post("/subscribe", pushController.subscribe);
router.delete("/unsubscribe", pushController.unsubscribe);

export default router;
