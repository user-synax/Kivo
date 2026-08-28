import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import * as usersController from "./users.controller.js";

const router = Router();

// User discovery for the "add friend" UI. Requires auth.
router.use(authenticate);
router.get("/search", usersController.search);

export default router;
