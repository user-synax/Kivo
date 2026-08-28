import { Router } from "express";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import { authenticate } from "../../middleware/auth.js";
import * as authController from "./auth.controller.js";

const router = Router();

// Brute-force protection on credential endpoints.
const loginLimiter = rateLimiter({ keyPrefix: "login", windowSeconds: 900, max: 10 });
const refreshLimiter = rateLimiter({ keyPrefix: "refresh", windowSeconds: 60, max: 30 });

router.post("/register", authController.register);
router.post("/login", loginLimiter, authController.login);
router.post("/refresh-token", refreshLimiter, authController.refreshToken);

// Authenticated session controls. The session id is taken from the verified
// access token, so these never trust a client-supplied value.
router.post("/logout", authenticate, authController.logout);
router.post("/logout-all", authenticate, authController.logoutAll);

export default router;
