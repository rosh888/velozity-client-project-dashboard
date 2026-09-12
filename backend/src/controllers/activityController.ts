import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { activityWhereForUser } from "../services/scope";

// Backs both the initial feed load and the reconnect catch-up. `after` is
// the createdAt of the last event the client already has; everything newer
// than that (still scoped to the caller's role) comes straight from
// Postgres, not from any in-memory cache.
export const listActivity = asyncHandler(async (req: Request, res: Response) => {
  const { after, limit } = req.query as any;

  const activities = await prisma.activityLog.findMany({
    where: {
      ...activityWhereForUser(req.user!),
      ...(after ? { createdAt: { gt: after } } : {}),
    },
    include: {
      actor: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: after ? "asc" : "desc" },
    take: limit,
  });

  res.json({ success: true, data: activities });
});
