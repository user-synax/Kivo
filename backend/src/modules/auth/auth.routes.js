import { Router } from "express";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import { authenticate } from "../../middleware/auth.js";
import * as authController from "./auth.controller.js";

const router = Router();

// Brute-force protection on credential endpoints.
const loginLimiter = rateLimiter({ keyPrefix: "login", windowSeconds: 900, max: 10 });
const refreshLimiter = rateLimiter({ keyPrefix: "refresh", windowSeconds: 60, max: 30 });
const forgotPasswordLimiter = rateLimiter({ keyPrefix: "forgot-password", windowSeconds: 300, max: 5 });
const resetPasswordLimiter = rateLimiter({ keyPrefix: "reset-password", windowSeconds: 300, max: 10 });
const resendVerificationLimiter = rateLimiter({ keyPrefix: "resend-verification", windowSeconds: 60, max: 1 });
const registerLimiter = rateLimiter({
  keyPrefix: "register",
  windowSeconds: 3600,
  max: 5,
  keyFrom: (req) => req.ip,
});

router.post("/register", registerLimiter, authController.register);
router.post("/login", loginLimiter, authController.login);
router.post("/refresh-token", refreshLimiter, authController.refreshToken);

// Authenticated session controls. The session id is taken from the verified
// access token, so these never trust a client-supplied value.
router.post("/logout", authenticate, authController.logout);
router.post("/logout-all", authenticate, authController.logoutAll);

// Email verification (link flow)
router.get("/verify-email", authController.verifyEmail);
router.post("/resend-verification", authenticate, resendVerificationLimiter, authController.resendVerification);

// Password reset (public, no auth required)
router.post("/forgot-password", forgotPasswordLimiter, authController.forgotPassword);
router.post("/reset-password", resetPasswordLimiter, authController.resetPassword);

export default router;
