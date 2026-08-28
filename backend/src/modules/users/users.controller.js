import multer from "multer";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { badRequest } from "../../utils/errors.js";
import {
  parseBody,
  parseQuery,
  searchQuerySchema,
  updateMeSchema,
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

// Avatar upload. multer parses multipart; we then hand the buffer to the
// service which stores it in Appwrite and returns the updated public profile.
export const updateAvatar = (req, res) => {
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
      const status = e.statusCode || 500;
      res.status(status).json({
        success: false,
        error: { message: e.message, code: e.code || "SERVER_ERROR" },
      });
    }
  });
};

export const deleteAvatar = asyncHandler(async (req, res) => {
  const user = await usersService.deleteAvatar({ userId: req.user.userId });
  res.status(200).json({ success: true, data: user });
});
