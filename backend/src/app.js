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

const app = express();

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
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/conversations", conversationRoutes);
app.use("/api/v1/messages", messageRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/friends", friendRoutes);
app.use("/api/v1/spaces", spaceRoutes);

// 404 + centralized error handler (must be registered last).
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
