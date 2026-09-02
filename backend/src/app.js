import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";

import env from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import authRoutes from "./modules/auth/auth.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import conversationRoutes from "./modules/conversations/conversations.routes.js";
import messageRoutes from "./modules/messages/messages.routes.js";
import userRoutes from "./modules/users/users.routes.js";
import friendRoutes from "./modules/friends/friends.routes.js";
import spaceRoutes from "./modules/spaces/spaces.routes.js";
import notificationRoutes from "./modules/notifications/notifications.routes.js";
import pushRoutes from "./modules/push/push.routes.js";
import attachmentRoutes from "./modules/attachments/attachments.routes.js";
import searchRoutes from "./modules/search/search.routes.js";

const app = express();

// Trust the first proxy (Render/Railway/Heroku LB) so req.ip respects
// X-Forwarded-For. Required for correct IP fallback when rate-limiting
// pre-auth routes (login, refresh, etc.).
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: env.corsAllowedOrigins ? env.corsAllowedOrigins.split(",").map((s) => s.trim()) : true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Health check.
app.get("/health", (req, res) => res.json({ success: true, data: { status: "ok" } }));

// API routes.
app.use("/api/v1/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/v1/conversations", conversationRoutes);
app.use("/api/v1/messages", messageRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/friends", friendRoutes);
app.use("/api/v1/spaces", spaceRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/push", pushRoutes);
app.use("/api/v1/attachments", attachmentRoutes);
app.use("/api/v1/search", searchRoutes);

// 404 + centralized error handler (must be registered last).
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
