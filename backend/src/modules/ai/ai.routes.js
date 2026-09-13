import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import * as aiController from "./ai.controller.js";

const router = Router();

// All AI routes require authentication.
router.use(authenticate);

// AI calls fan out to Groq/Gemini — heavier than a DB query. Burst guard
// per user; daily quota (free 30 / plus 100) is enforced in ai.service.js
// and the service also caches identical prompts for 1h.
const aiLimiter = rateLimiter({
  keyPrefix: "ai",
  windowSeconds: 60,
  max: 20,
});

router.get("/status", aiController.status);
router.post("/proofread", aiLimiter, aiController.proofread);
router.post("/rewrite", aiLimiter, aiController.rewrite);
router.post("/translate", aiLimiter, aiController.translate);
router.post("/replies", aiLimiter, aiController.replies);
router.post("/summarize", aiLimiter, aiController.summarize);

export default router;
