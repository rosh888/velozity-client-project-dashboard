import { z } from "zod";

export const activityQuerySchema = z.object({
  after: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
