import { asyncHandler } from "../../utils/asyncHandler.js";
import { aiConfigured } from "../../lib/ai-providers.js";
import * as aiService from "./ai.service.js";
import { parseBody, proofreadSchema, repliesSchema, rewriteSchema, summarizeSchema, translateSchema } from "./ai.validation.js";

function requireConfigured() {
  if (!aiConfigured()) {
    const err = new Error("AI is not configured on this server (set GROQ_API_KEY or GEMINI_API_KEY)");
    err.statusCode = 503;
    err.code = "AI_NOT_CONFIGURED";
    throw err;
  }
}

export const proofread = asyncHandler(async (req, res) => {
  requireConfigured();
  const body = parseBody(proofreadSchema, req.body);
  const data = await aiService.proofread(req.user.userId || req.user.id, body);
  res.status(200).json({ success: true, data });
});

export const rewrite = asyncHandler(async (req, res) => {
  requireConfigured();
  const body = parseBody(rewriteSchema, req.body);
  const data = await aiService.rewrite(req.user.userId || req.user.id, body);
  res.status(200).json({ success: true, data });
});

export const translate = asyncHandler(async (req, res) => {
  requireConfigured();
  const body = parseBody(translateSchema, req.body);
  const data = await aiService.translate(req.user.userId || req.user.id, body);
  res.status(200).json({ success: true, data });
});

export const replies = asyncHandler(async (req, res) => {
  requireConfigured();
  const body = parseBody(repliesSchema, req.body);
  const data = await aiService.suggestReplies(req.user.userId || req.user.id, body);
  res.status(200).json({ success: true, data });
});

export const summarize = asyncHandler(async (req, res) => {
  requireConfigured();
  const body = parseBody(summarizeSchema, req.body);
  const data = await aiService.summarize(req.user.userId || req.user.id, body);
  res.status(200).json({ success: true, data });
});

export const status = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { configured: aiConfigured() } });
});
