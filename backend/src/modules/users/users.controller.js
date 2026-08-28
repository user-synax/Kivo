import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseQuery, searchQuerySchema } from "./users.validation.js";
import * as usersService from "./users.service.js";

export const search = asyncHandler(async (req, res) => {
  const { q } = parseQuery(searchQuerySchema, req.query);
  const users = await usersService.searchUsers({ userId: req.user.userId, q });
  res.status(200).json({ success: true, data: users });
});
