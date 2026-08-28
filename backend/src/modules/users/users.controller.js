import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  parseBody,
  parseQuery,
  searchQuerySchema,
  updateMeSchema,
} from "./users.validation.js";
import * as usersService from "./users.service.js";

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
