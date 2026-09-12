import { prisma } from "../lib/prisma";
import { emitActivity } from "../sockets/io";
import type { TaskStatus } from "@prisma/client";

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
  OVERDUE: "Overdue",
};

interface RecordStatusChangeArgs {
  taskId: string;
  taskTitle: string;
  projectId: string;
  actorId: string;
  actorName: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  assigneeId: string | null;
}

export async function recordStatusChange(args: RecordStatusChangeArgs) {
  const message = args.fromStatus
    ? `${args.actorName} moved "${args.taskTitle}" from ${STATUS_LABEL[args.fromStatus]} → ${STATUS_LABEL[args.toStatus]}`
    : `${args.actorName} created "${args.taskTitle}" as ${STATUS_LABEL[args.toStatus]}`;

  const activity = await prisma.activityLog.create({
    data: {
      taskId: args.taskId,
      projectId: args.projectId,
      actorId: args.actorId,
      fromStatus: args.fromStatus ?? undefined,
      toStatus: args.toStatus,
      message,
    },
  });

  emitActivity({
    id: activity.id,
    taskId: args.taskId,
    projectId: args.projectId,
    actorId: args.actorId,
    actorName: args.actorName,
    fromStatus: args.fromStatus,
    toStatus: args.toStatus,
    message,
    createdAt: activity.createdAt.toISOString(),
    assigneeId: args.assigneeId,
  });

  return activity;
}
