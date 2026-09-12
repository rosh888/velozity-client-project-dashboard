import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import type { Role } from "@prisma/client";
import { verifyAccessToken } from "../lib/tokens";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { assertProjectReadAccess, assertTaskReadAccess } from "../services/scope";

interface SocketUser {
  id: string;
  role: Role;
}

declare module "socket.io" {
  interface Socket {
    user: SocketUser;
  }
}

let io: Server | undefined;

// presence is just live connection state, not history, so keeping it in
// memory (not the DB) is fine - it doesn't need to survive a restart
const onlineUsers = new Map<string, Set<string>>(); // userId -> socketIds

export function getOnlineUserCount(): number {
  return onlineUsers.size;
}

function addPresence(userId: string, socketId: string) {
  const set = onlineUsers.get(userId) ?? new Set<string>();
  set.add(socketId);
  onlineUsers.set(userId, set);
}

function removePresence(userId: string, socketId: string) {
  const set = onlineUsers.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) onlineUsers.delete(userId);
}

function broadcastPresence() {
  io?.to("global").emit("presence:update", { count: getOnlineUserCount() });
}

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("unauthorized"));
    try {
      const payload = verifyAccessToken(token);
      socket.user = { id: payload.sub, role: payload.role };
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const { id: userId, role } = socket.user;

    socket.join(`user:${userId}`);
    if (role === "ADMIN") socket.join("global");

    addPresence(userId, socket.id);
    broadcastPresence();

    if (role === "PROJECT_MANAGER") {
      prisma.project
        .findMany({ where: { ownerId: userId }, select: { id: true } })
        .then((projects) => {
          projects.forEach((p) => socket.join(`project:${p.id}`));
        })
        .catch(() => undefined);
    }

    // Explicit server-side check so a client can't just join another
    // project's room by guessing its id.
    socket.on("project:join", async (payload: { projectId?: string }, ack) => {
      const projectId = payload?.projectId;
      if (!projectId) return ack?.({ ok: false, error: "projectId required" });
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true },
      });
      if (!project) return ack?.({ ok: false, error: "not found" });
      try {
        assertProjectReadAccess(socket.user, project);
      } catch {
        return ack?.({ ok: false, error: "forbidden" });
      }
      socket.join(`project:${projectId}`);
      ack?.({ ok: true });
    });

    socket.on("task:join", async (payload: { taskId?: string }, ack) => {
      const taskId = payload?.taskId;
      if (!taskId) return ack?.({ ok: false, error: "taskId required" });
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { assigneeId: true, project: { select: { ownerId: true } } },
      });
      if (!task) return ack?.({ ok: false, error: "not found" });
      try {
        assertTaskReadAccess(socket.user, task);
      } catch {
        return ack?.({ ok: false, error: "forbidden" });
      }
      socket.join(`task:${taskId}`);
      ack?.({ ok: true });
    });

    socket.on("disconnect", () => {
      removePresence(userId, socket.id);
      broadcastPresence();
    });
  });

  return io;
}

export interface ActivityBroadcastPayload {
  id: string;
  taskId: string;
  projectId: string;
  actorId: string;
  actorName: string;
  fromStatus: string | null;
  toStatus: string;
  message: string;
  createdAt: string;
  assigneeId: string | null;
}

export function emitActivity(activity: ActivityBroadcastPayload) {
  if (!io) return;
  io.to("global")
    .to(`project:${activity.projectId}`)
    .to(`task:${activity.taskId}`)
    .emit("activity:new", activity);

  // Developers aren't in the project room, so mirror the event into their
  // personal room whenever the activity concerns a task assigned to them.
  if (activity.assigneeId) {
    io.to(`user:${activity.assigneeId}`).emit("activity:new", activity);
  }
}

export interface NotificationBroadcastPayload {
  id: string;
  userId: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  unreadCount: number;
}

export function emitNotification(payload: NotificationBroadcastPayload) {
  if (!io) return;
  io.to(`user:${payload.userId}`).emit("notification:new", payload);
}

export function emitUnreadCount(userId: string, unreadCount: number) {
  if (!io) return;
  io.to(`user:${userId}`).emit("notification:count", { unreadCount });
}
