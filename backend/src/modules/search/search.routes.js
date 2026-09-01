import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import * as searchController from "./search.controller.js";

const router = Router();

// All search routes require authentication.
router.use(authenticate);

router.get("/", searchController.search);

export default router;
