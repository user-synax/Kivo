import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseBody, parseQuery, createEmojiSchema, listEmojiQuerySchema } from "./emoji.validation.js";
import * as svc from "./emoji.service.js";

export const listEmojis = asyncHandler(async (req, res) => {
  const { spaceId, personal } = parseQuery(listEmojiQuerySchema, req.query);
  // Query param arrives as string; treat "null"/"undefined"/"" as null (global)
  let sid = spaceId;
  if (sid === "" || sid === "null" || sid === "undefined") sid = null;
  if (personal) {
    const data = await svc.listPersonalEmojis({ userId: req.user.userId });
    return res.json({ success: true, data });
  }
  const data = await svc.listEmojis({ spaceId: sid || null, userId: req.user.userId });
  res.json({ success: true, data });
});

export const listPersonal = asyncHandler(async (req, res) => {
  const data = await svc.listPersonalEmojis({ userId: req.user.userId });
  res.json({ success: true, data });
});

export const createEmoji = asyncHandler(async (req, res) => {
  // Multer puts text fields in req.body; name + spaceId come from there
  const rawName = req.body?.name || "";
  const rawSpaceId = req.body?.spaceId || null;
  const rawPersonal = req.body?.personal;
  const isPersonal = rawPersonal === true || rawPersonal === "true" || rawPersonal === "1";
  const parsed = parseBody(createEmojiSchema, {
    name: rawName,
    spaceId: rawSpaceId && rawSpaceId !== "null" && rawSpaceId !== "undefined" && rawSpaceId !== "" ? rawSpaceId : null,
    personal: isPersonal,
  });

  const file = req.file || null;
  if (!file) {
    return res.status(400).json({
      success: false,
      error: { code: "NO_FILE", message: "Image file required (field name: 'image')" },
    });
  }

  const emoji = await svc.createEmoji({
    userId: req.user.userId,
    name: parsed.name,
    spaceId: parsed.spaceId || null,
    personal: Boolean(parsed.personal),
    file: { buffer: file.buffer, mimetype: file.mimetype, size: file.size, originalname: file.originalname },
  });
  res.status(201).json({ success: true, data: emoji });
});

export const deleteEmoji = asyncHandler(async (req, res) => {
  const result = await svc.deleteEmoji({ emojiId: req.params.id, userId: req.user.userId });
  res.json({ success: true, data: result });
});
