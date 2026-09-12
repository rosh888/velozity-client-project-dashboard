import { prisma } from "../lib/prisma";
import { emitNotification } from "../sockets/io";
import type { NotificationType } from "@prisma/client";

interface CreateNotificationArgs {
  userId: string;
  taskId?: string;
  type: NotificationType;
  message: string;
}

export async function createNotification(args: CreateNotificationArgs) {
  const notification = await prisma.notification.create({
    data: {
      userId: args.userId,
      taskId: args.taskId,
      type: args.type,
      message: args.message,
    },
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: args.userId, isRead: false },
  });

  emitNotification({
    id: notification.id,
    userId: notification.userId,
    message: notification.message,
    type: notification.type,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
    unreadCount,
  });

  return notification;
}
