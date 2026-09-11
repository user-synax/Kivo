import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";

import env from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
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
import linkPreviewRoutes from "./modules/link-preview/link-preview.routes.js";
import callsRoutes from "./modules/calls/calls.routes.js";
import plusRoutes from "./modules/plus/plus.routes.js";
import statusRoutes from "./modules/status/status.routes.js";
import emojiRoutes from "./modules/emoji/emoji.routes.js";

const app = express();

// Trust the first proxy (Render/Railway/Heroku LB) so req.ip respects
// X-Forwarded-For. Required for correct IP fallback when rate-limiting
// pre-auth routes (login, refresh, etc.).
app.set("trust proxy", 1);

// Require explicit CORS origins in production — fail fast if unset.
if (env.nodeEnv === "production" && !env.corsAllowedOrigins) {
  throw new Error("CORS_ALLOWED_ORIGINS must be set in production (comma-separated origins, e.g. https://kivo.app)");
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        fontSrc: ["'self'", "https:", "data:"],
        connectSrc: [
          "'self'",
          "https:",
          "wss:",
          "ws:",
          env.frontendUrl,
          env.appwriteEndpoint,
          env.livekitUrl,
        ].filter(Boolean),
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false, // required for LiveKit/Appwrite cross-origin embeds
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin: env.corsAllowedOrigins
      ? env.corsAllowedOrigins.split(",").map((s) => s.trim())
      : env.nodeEnv === "production"
        ? false
        : true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

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
app.use("/api/v1/link-preview", linkPreviewRoutes);
app.use("/api/v1/calls", callsRoutes);
app.use("/api/v1/plus", plusRoutes);
app.use("/api/v1/status", statusRoutes);
app.use("/api/v1/emoji", emojiRoutes);

// 404 + centralized error handler (must be registered last).
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
