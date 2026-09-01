import { asyncHandler } from "../../utils/asyncHandler.js";
import { searchQuerySchema, parseQuery } from "./search.validation.js";
import * as searchService from "./search.service.js";

export const search = asyncHandler(async (req, res) => {
  const { q, limit } = parseQuery(searchQuerySchema, req.query);
  const results = await searchService.globalSearch({
    userId: req.user.userId,
    q,
    limit,
  });
  res.status(200).json({ success: true, data: results });
});
