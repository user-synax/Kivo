import { z } from "zod";

export const STATUS_BACKGROUNDS = ["default","accent","sunset","ocean","forest","midnight"];

export const createStatusSchema = z.object({
  text: z.string().trim().min(1, "Status cannot be empty").max(280, "Max 280 characters"),
  background: z.enum(STATUS_BACKGROUNDS).optional().default("default"),
});

export const statusIdParamSchema = z.object({
  id: z.string().min(1),
});
