import multer from "multer";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { badRequest } from "../../utils/errors.js";
import {
  locationSchema,
  nearbyQuerySchema,
  parseBody,
  parseParams,
  parseQuery,
  privacySchema,
  searchQuerySchema,
  updateMeSchema,
  usernameParamSchema,
} from "./users.validation.js";
import * as usersService from "./users.service.js";

// Avatar upload — single image field "avatar", max 4MB, image types only.
const ALLOWED_AVATAR_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const uploadAvatarMulter = multer({
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_AVATAR_TYPES.has(file.mimetype)) {
      cb(new Error("Unsupported image type"));
      return;
    }
    cb(null, true);
  },
}).single("avatar");

// Custom (Plus) banner upload — single image field "banner", max 8MB. Same
// image allow-list as avatars; the service enforces the plan entitlement.
const uploadBannerMulter = multer({
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_AVATAR_TYPES.has(file.mimetype)) {
      cb(new Error("Unsupported image type"));
      return;
    }
    cb(null, true);
  },
}).single("banner");

export const getMe = asyncHandler(async (req, res) => {
  const user = await usersService.getMe({ userId: req.user.userId });
  res.status(200).json({ success: true, data: user });
});

export const updateMe = asyncHandler(async (req, res) => {
  const data = parseBody(updateMeSchema, req.body);
  const user = await usersService.updateMe({ userId: req.user.userId, data });
  res.status(200).json({ success: true, data: user });
});

export const search = asyncHandler(async (req, res) => {
  const { q } = parseQuery(searchQuerySchema, req.query);
  const users = await usersService.searchUsers({ userId: req.user.userId, q });
  res.status(200).json({ success: true, data: users });
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await usersService.getUserById({ otherId: req.params.id });
  res.status(200).json({ success: true, data: user });
});

export const getProfileByUsername = asyncHandler(async (req, res) => {
  const { username } = parseParams(usernameParamSchema, req.params);
  // Route is optional-auth: req.user exists only when a valid Bearer token was
  // sent. Anonymous readers get the public shape with no relationship state.
  const profile = await usersService.getProfileByUsername({
    requesterId: req.user?.userId || null,
    username,
  });
  res.status(200).json({ success: true, data: profile });
});

// Avatar upload. multer parses multipart; we then hand the buffer to the
// service which stores it in Appwrite and returns the updated public profile.
export const updateAvatar = (req, res, next) => {
  uploadAvatarMulter(req, res, async (err) => {
    try {
      if (err) {
        const e = new Error(err.message || "Upload failed");
        e.statusCode = 400;
        e.code = "UPLOAD_ERROR";
        throw e;
      }
      if (!req.file) {
        const e = new Error("No file uploaded");
        e.statusCode = 400;
        e.code = "NO_FILE";
        throw e;
      }
      const user = await usersService.updateAvatar({
        userId: req.user.userId,
        buffer: req.file.buffer,
        contentType: req.file.mimetype,
      });
      res.status(200).json({ success: true, data: user });
    } catch (e) {
      next(e);
    }
  });
};

// Custom banner upload (Kivo Plus). Mirrors the avatar upload shape; the
// service rejects non-plus plans with PLUS_REQUIRED.
export const updateBanner = (req, res, next) => {
  uploadBannerMulter(req, res, async (err) => {
    try {
      if (err) {
        const e = new Error(err.message || "Upload failed");
        e.statusCode = 400;
        e.code = "UPLOAD_ERROR";
        throw e;
      }
      if (!req.file) {
        const e = new Error("No file uploaded");
        e.statusCode = 400;
        e.code = "NO_FILE";
        throw e;
      }
      const user = await usersService.updateBanner({
        userId: req.user.userId,
        buffer: req.file.buffer,
        contentType: req.file.mimetype,
      });
      res.status(200).json({ success: true, data: user });
    } catch (e) {
      next(e);
    }
  });
};

export const deleteAvatar = asyncHandler(async (req, res) => {
  const user = await usersService.deleteAvatar({ userId: req.user.userId });
  res.status(200).json({ success: true, data: user });
});

export const listBlocked = asyncHandler(async (req, res) => {
  const users = await usersService.listBlockedUsers({ userId: req.user.userId });
  res.status(200).json({ success: true, data: users });
});

export const blockUser = asyncHandler(async (req, res) => {
  const result = await usersService.blockUser({ userId: req.user.userId, targetId: req.params.id });
  res.status(200).json({ success: true, data: result });
});

export const unblockUser = asyncHandler(async (req, res) => {
  const result = await usersService.unblockUser({ userId: req.user.userId, targetId: req.params.id });
  res.status(200).json({ success: true, data: result });
});

export const updatePrivacy = asyncHandler(async (req, res) => {
  const prefs = parseBody(privacySchema, req.body);
  const result = await usersService.updatePrivacy({ userId: req.user.userId, ...prefs });
  res.status(200).json({ success: true, data: result });
});

export const updateLocation = asyncHandler(async (req, res) => {
  const { lat, lng, accuracy } = parseBody(locationSchema, req.body);
  const result = await usersService.updateLocation({ userId: req.user.userId, lat, lng, accuracy });
  res.status(200).json({ success: true, data: result });
});

export const deleteLocation = asyncHandler(async (req, res) => {
  const result = await usersService.clearLocation({ userId: req.user.userId });
  res.status(200).json({ success: true, data: result });
});

export const getNearby = asyncHandler(async (req, res) => {
  const { radius, limit } = parseQuery(nearbyQuerySchema, req.query);
  const users = await usersService.getNearbyUsers({ userId: req.user.userId, radius, limit });
  res.status(200).json({ success: true, data: users });
});

export const completeOnboarding = asyncHandler(async (req, res) => {
  const result = await usersService.completeOnboarding({ userId: req.user.userId });
  res.status(200).json({ success: true, data: result });
});
