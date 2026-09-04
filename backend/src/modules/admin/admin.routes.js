import { Router } from "express";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import { requireAdmin } from "../../middleware/adminAuth.js";
import * as adminController from "./admin.controller.js";

const router = Router();

// Brute-force protection on the single admin login endpoint — 5 attempts per 15 min.
const adminLoginLimiter = rateLimiter({
  keyPrefix: "admin-login",
  windowSeconds: 900,
  max: 5,
});

// Public: admin login
router.post("/login", adminLoginLimiter, adminController.login);

// Everything below requires a valid admin_token cookie.
router.use(requireAdmin);

// Auth
router.get("/verify", adminController.verify);
router.post("/logout", adminController.logout);

// Stats
router.get("/stats", adminController.getStats);

// Users
router.get("/users", adminController.listUsers);
router.get("/users/:id", adminController.getUserDetail);
router.post("/users/:id/ban", adminController.banUser);
router.post("/users/:id/unban", adminController.unbanUser);
router.post("/users/:id/plan", adminController.setUserPlan);

// Groups
router.get("/groups", adminController.listGroups);
router.delete("/groups/:id", adminController.deleteGroup);

// Spaces
router.get("/spaces", adminController.listSpaces);
router.delete("/spaces/:id", adminController.deleteSpace);

export default router;
