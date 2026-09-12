import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  clientId: z.string().uuid(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
