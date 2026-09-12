import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { getOnlineUserCount } from "../sockets/io";
import { projectWhereForUser, taskWhereForUser } from "../services/scope";

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;

  if (user.role === "ADMIN") {
    const [totalProjects, statusGroups, overdueCount] = await Promise.all([
      prisma.project.count(),
      prisma.task.groupBy({ by: ["status"], _count: true }),
      prisma.task.count({ where: { status: "OVERDUE" } }),
    ]);
    const totalTasks = statusGroups.reduce((sum, g) => sum + g._count, 0);
    const tasksByStatus = Object.fromEntries(statusGroups.map((g) => [g.status, g._count]));

    return res.json({
      success: true,
      data: {
        role: "ADMIN",
        totalProjects,
        totalTasks,
        tasksByStatus,
        overdueCount,
        onlineUsers: getOnlineUserCount(),
      },
    });
  }

  if (user.role === "PROJECT_MANAGER") {
    const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [projects, priorityGroups, upcoming] = await Promise.all([
      prisma.project.findMany({
        where: projectWhereForUser(user),
        include: { _count: { select: { tasks: true } } },
      }),
      prisma.task.groupBy({
        by: ["priority"],
        _count: true,
        where: taskWhereForUser(user),
      }),
      prisma.task.findMany({
        where: {
          ...taskWhereForUser(user),
          dueDate: { gte: new Date(), lte: weekFromNow },
        },
        include: { assignee: { select: { id: true, name: true } } },
        orderBy: { dueDate: "asc" },
        take: 10,
      }),
    ]);

    return res.json({
      success: true,
      data: {
        role: "PROJECT_MANAGER",
        projects,
        tasksByPriority: Object.fromEntries(priorityGroups.map((g) => [g.priority, g._count])),
        upcomingDueDates: upcoming,
      },
    });
  }

  // DEVELOPER
  const tasks = await prisma.task.findMany({
    where: taskWhereForUser(user),
    include: { project: { select: { id: true, name: true } } },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
  });

  res.json({ success: true, data: { role: "DEVELOPER", tasks } });
});
