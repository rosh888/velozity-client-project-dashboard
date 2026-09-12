export type Role = "ADMIN" | "PROJECT_MANAGER" | "DEVELOPER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "OVERDUE";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type NotificationType = "TASK_ASSIGNED" | "TASK_IN_REVIEW" | "TASK_STATUS_CHANGED";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Client {
  id: string;
  name: string;
  email: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  clientId: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; name: string };
  owner?: { id: string; name: string };
  _count?: { tasks: number };
  tasks?: Task[];
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  projectId: string;
  assigneeId: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: { id: string; name: string } | null;
  project?: { id: string; name: string; ownerId: string };
  activityLogs?: ActivityLog[];
}

export interface ActivityLog {
  id: string;
  taskId: string;
  projectId: string;
  actorId: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  message: string;
  createdAt: string;
  actor?: { id: string; name: string };
  task?: { id: string; title: string };
  project?: { id: string; name: string };
}

export interface ActivityEvent {
  id: string;
  taskId: string;
  projectId: string;
  actorId: string;
  actorName: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  message: string;
  createdAt: string;
  assigneeId: string | null;
}

export interface AppNotification {
  id: string;
  userId: string;
  taskId: string | null;
  type: NotificationType;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ApiError {
  success: false;
  error: { code: string; message: string; details?: unknown };
}
