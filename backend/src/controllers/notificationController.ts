import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { Errors } from "../lib/errors";
import { emitUnreadCount } from "../sockets/io";

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unreadCount = await prisma.notification.count({
    where: { userId: req.user!.id, isRead: false },
  });
  res.json({ success: true, data: notifications, meta: { unreadCount } });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notification || notification.userId !== req.user!.id) {
    throw Errors.notFound("Notification not found");
  }

  await prisma.notification.update({ where: { id: notification.id }, data: { isRead: true } });

  const unreadCount = await prisma.notification.count({
    where: { userId: req.user!.id, isRead: false },
  });
  emitUnreadCount(req.user!.id, unreadCount);

  res.json({ success: true, data: { unreadCount } });
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, isRead: false },
    data: { isRead: true },
  });
  emitUnreadCount(req.user!.id, 0);
  res.json({ success: true, data: { unreadCount: 0 } });
});
