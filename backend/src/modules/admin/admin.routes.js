import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import * as adminController from "./admin.controller.js";

const router = Router();

// Every admin route requires a valid access token AND the "admin" role.
router.use(authenticate, authorize(["admin"]));

router.post("/users/:id/force-logout", adminController.forceLogoutUser);
router.get("/users", adminController.listUsers);

export default router;
