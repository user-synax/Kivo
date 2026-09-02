import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import * as searchController from "./search.controller.js";

const router = Router();

// All search routes require authentication.
router.use(authenticate);

// Per-user limiter: underlying query is a Message.find text/regex search,
// so cap at 30 searches/minute per user.
const searchLimiter = rateLimiter({
  keyPrefix: "search",
  windowSeconds: 60,
  max: 30,
});

router.get("/", searchLimiter, searchController.search);

export default router;
