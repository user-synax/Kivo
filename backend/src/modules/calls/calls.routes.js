import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import * as callsController from "./calls.controller.js";

const router = Router();

// All call endpoints require a valid access token.
router.use(authenticate);

// Token mints are cheap but sensitive — 20/minute per user matches the
// friend-request limiter and stops token farming.
const callTokenLimiter = rateLimiter({
  keyPrefix: "call-token",
  windowSeconds: 60,
  max: 20,
});

router.get("/config", callsController.callsConfig);
router.post("/token", callTokenLimiter, callsController.issueToken);
router.get("/status", callsController.callStatus);

export default router;
