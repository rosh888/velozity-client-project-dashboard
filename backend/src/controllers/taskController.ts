import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { Errors } from "../lib/errors";
import {
  assertProjectWriteAccess,
  assertTaskManageAccess,
  assertTaskReadAccess,
  assertTaskStatusAccess,
  taskWhereForUser,
} from "../services/scope";
import { recordStatusChange } from "../services/activityService";
import { createNotification } from "../services/notificationService";

const TASK_INCLUDE = {
  assignee: { select: { id: true, name: true } },
  project: { select: { id: true, name: true, ownerId: true } },
} satisfies Prisma.TaskInclude;

export const listTasks = asyncHandler(async (req: Request, res: Response) => {
  const { status, priority, from, to, projectId, page, pageSize } = req.query as any;

  const where: Prisma.TaskWhereInput = { ...taskWhereForUser(req.user!) };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (from || to) {
    where.dueDate = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }
  if (projectId) {
    // PMs/Devs get this AND-ed with their own scope above, so asking for a
    // project they don't own/aren't assigned in just yields zero rows.
    where.projectId = projectId;
  }

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.task.count({ where }),
  ]);

  res.json({ success: true, data: tasks, meta: { page, pageSize, total } });
});

export const getTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: {
      ...TASK_INCLUDE,
      activityLogs: {
        include: { actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!task) throw Errors.notFound("Task not found");
  assertTaskReadAccess(req.user!, task);
  res.json({ success: true, data: task });
});

export const createTask = asyncHandler(async (req: Request, res: Response) => {
  const { title, description, projectId, assigneeId, priority, dueDate } = req.body;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw Errors.notFound("Project not found");
  assertProjectWriteAccess(req.user!, project);

  if (assigneeId) {
    const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
    if (!assignee || assignee.role !== "DEVELOPER") {
      throw Errors.badRequest("assigneeId must belong to a developer");
    }
  }

  const task = await prisma.task.create({
    data: { title, description, projectId, assigneeId, priority, dueDate },
    include: TASK_INCLUDE,
  });

  await recordStatusChange({
    taskId: task.id,
    taskTitle: task.title,
    projectId: task.projectId,
    actorId: req.user!.id,
    actorName: (await prisma.user.findUnique({ where: { id: req.user!.id } }))!.name,
    fromStatus: null,
    toStatus: task.status,
    assigneeId: task.assigneeId,
  });

  if (task.assigneeId) {
    await createNotification({
      userId: task.assigneeId,
      taskId: task.id,
      type: "TASK_ASSIGNED",
      message: `You were assigned to "${task.title}"`,
    });
  }

  res.status(201).json({ success: true, data: task });
});

export const updateTask = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: { project: { select: { ownerId: true } } },
  });
  if (!existing) throw Errors.notFound("Task not found");
  assertTaskManageAccess(req.user!, existing);

  if (req.body.assigneeId) {
    const assignee = await prisma.user.findUnique({ where: { id: req.body.assigneeId } });
    if (!assignee || assignee.role !== "DEVELOPER") {
      throw Errors.badRequest("assigneeId must belong to a developer");
    }
  }

  const wasUnassigned = !existing.assigneeId;
  const task = await prisma.task.update({
    where: { id: existing.id },
    data: req.body,
    include: TASK_INCLUDE,
  });

  if (task.assigneeId && (wasUnassigned || task.assigneeId !== existing.assigneeId)) {
    await createNotification({
      userId: task.assigneeId,
      taskId: task.id,
      type: "TASK_ASSIGNED",
      message: `You were assigned to "${task.title}"`,
    });
  }

  res.json({ success: true, data: task });
});

export const updateTaskStatus = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: { project: { select: { id: true, ownerId: true } } },
  });
  if (!existing) throw Errors.notFound("Task not found");
  assertTaskStatusAccess(req.user!, existing);

  const { status } = req.body;
  const actor = await prisma.user.findUnique({ where: { id: req.user!.id } });

  const task = await prisma.task.update({
    where: { id: existing.id },
    data: { status },
    include: TASK_INCLUDE,
  });

  await recordStatusChange({
    taskId: task.id,
    taskTitle: task.title,
    projectId: task.projectId,
    actorId: req.user!.id,
    actorName: actor!.name,
    fromStatus: existing.status,
    toStatus: status,
    assigneeId: task.assigneeId,
  });

  if (status === "IN_REVIEW") {
    await createNotification({
      userId: existing.project.ownerId,
      taskId: task.id,
      type: "TASK_IN_REVIEW",
      message: `"${task.title}" was moved to In Review`,
    });
  }

  res.json({ success: true, data: task });
});
