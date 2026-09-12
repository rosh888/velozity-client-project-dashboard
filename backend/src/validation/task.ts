import { z } from "zod";

const taskStatusEnum = z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "OVERDUE"]);
const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const createTaskSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(4000).optional(),
  projectId: z.string().uuid(),
  assigneeId: z.string().uuid().optional(),
  priority: priorityEnum.optional(),
  dueDate: z.coerce.date().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(4000).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  priority: priorityEnum.optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

export const updateTaskStatusSchema = z.object({
  status: taskStatusEnum,
});

export const taskFilterSchema = z.object({
  status: taskStatusEnum.optional(),
  priority: priorityEnum.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  projectId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
