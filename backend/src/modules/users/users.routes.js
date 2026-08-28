import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import * as usersController from "./users.controller.js";

const router = Router();

// User discovery for the "add friend" UI. Requires auth.
router.use(authenticate);
router.get("/me", usersController.getMe);
router.patch("/me", usersController.updateMe);
router.get("/search", usersController.search);
router.get("/:id", usersController.getUserById);

export default router;
