import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import * as plusController from "./plus.controller.js";

const router = Router();

// Manual-UPI Plus claims — all routes require a valid access token.
router.use(authenticate);

// Filing a claim is cheap to abuse (spams the admin inbox), so 5/day/user.
const claimLimiter = rateLimiter({
  keyPrefix: "plus-claim",
  windowSeconds: 86400,
  max: 5,
});

router.post("/claim", claimLimiter, plusController.createClaim);
router.get("/claim", plusController.getMyClaim);

export default router;
