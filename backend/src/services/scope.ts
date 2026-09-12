import type { Prisma } from "@prisma/client";
import type { AuthUser } from "../middleware/auth";
import { Errors } from "../lib/errors";

// keeping all the "who can see/touch what" rules in one file so it's not
// reimplemented slightly differently in every controller

export function projectWhereForUser(user: AuthUser): Prisma.ProjectWhereInput {
  if (user.role === "ADMIN") return {};
  if (user.role === "PROJECT_MANAGER") return { ownerId: user.id };
  // devs don't get a project list of their own, only their tasks
  return { tasks: { some: { assigneeId: user.id } } };
}

export function assertProjectReadAccess(
  user: AuthUser,
  project: { ownerId: string }
): void {
  if (user.role === "ADMIN") return;
  if (user.role === "PROJECT_MANAGER" && project.ownerId === user.id) return;
  throw Errors.forbidden("You do not have access to this project");
}

export function assertProjectWriteAccess(
  user: AuthUser,
  project: { ownerId: string }
): void {
  if (user.role === "ADMIN") return;
  if (user.role === "PROJECT_MANAGER" && project.ownerId === user.id) return;
  throw Errors.forbidden("You do not have permission to modify this project");
}

export function taskWhereForUser(user: AuthUser): Prisma.TaskWhereInput {
  if (user.role === "ADMIN") return {};
  if (user.role === "PROJECT_MANAGER") return { project: { ownerId: user.id } };
  return { assigneeId: user.id };
}

export function assertTaskReadAccess(
  user: AuthUser,
  task: { assigneeId: string | null; project: { ownerId: string } }
): void {
  if (user.role === "ADMIN") return;
  if (user.role === "PROJECT_MANAGER" && task.project.ownerId === user.id) return;
  if (user.role === "DEVELOPER" && task.assigneeId === user.id) return;
  throw Errors.forbidden("You do not have access to this task");
}

export function assertTaskManageAccess(
  user: AuthUser,
  task: { project: { ownerId: string } }
): void {
  if (user.role === "ADMIN") return;
  if (user.role === "PROJECT_MANAGER" && task.project.ownerId === user.id) return;
  throw Errors.forbidden("You do not have permission to manage this task");
}

// A developer may only flip the status of a task assigned to them.
export function assertTaskStatusAccess(
  user: AuthUser,
  task: { assigneeId: string | null; project: { ownerId: string } }
): void {
  if (user.role === "ADMIN") return;
  if (user.role === "PROJECT_MANAGER" && task.project.ownerId === user.id) return;
  if (user.role === "DEVELOPER" && task.assigneeId === user.id) return;
  throw Errors.forbidden("You do not have permission to update this task");
}

export function activityWhereForUser(user: AuthUser): Prisma.ActivityLogWhereInput {
  if (user.role === "ADMIN") return {};
  if (user.role === "PROJECT_MANAGER") return { project: { ownerId: user.id } };
  return { task: { assigneeId: user.id } };
}
