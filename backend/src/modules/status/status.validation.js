import { z } from "zod";

export const STATUS_BACKGROUNDS = ["default","accent","sunset","ocean","forest","midnight"];

export const createStatusSchema = z.object({
  text: z.string().trim().max(280, "Max 280 characters").optional().default(""),
  background: z.enum(STATUS_BACKGROUNDS).optional().default("default"),
});

export const statusIdParamSchema = z.object({
  id: z.string().min(1),
});
