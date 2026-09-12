import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { recordStatusChange } from "../services/activityService";

export const SYSTEM_USER_EMAIL = "system@velozity.internal";
const SYSTEM_ACTOR_NAME = "System";

let systemUserId: string | undefined;

// ActivityLog.actorId is a real FK and the scheduler has no logged-in user,
// so automated changes get attributed to one fixed system account instead
// of making the column nullable just for this case.
async function getSystemUserId(): Promise<string> {
  if (systemUserId) return systemUserId;
  const user = await prisma.user.upsert({
    where: { email: SYSTEM_USER_EMAIL },
    update: {},
    create: {
      name: SYSTEM_ACTOR_NAME,
      email: SYSTEM_USER_EMAIL,
      passwordHash: "!",
      role: "ADMIN",
    },
  });
  systemUserId = user.id;
  return systemUserId;
}

// Flips any TODO/IN_PROGRESS/IN_REVIEW task past its due date to OVERDUE.
// Runs on a schedule, not on page load, so overdue state is a real stored
// fact and not something recalculated on every request.
export async function markOverdueTasks(): Promise<number> {
  const overdueTasks = await prisma.task.findMany({
    where: {
      dueDate: { lt: new Date() },
      status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] },
    },
    select: { id: true, title: true, projectId: true, assigneeId: true, status: true },
  });

  if (overdueTasks.length === 0) return 0;
  const actorId = await getSystemUserId();

  for (const task of overdueTasks) {
    await prisma.task.update({ where: { id: task.id }, data: { status: "OVERDUE" } });
    await recordStatusChange({
      taskId: task.id,
      taskTitle: task.title,
      projectId: task.projectId,
      actorId,
      actorName: SYSTEM_ACTOR_NAME,
      fromStatus: task.status,
      toStatus: "OVERDUE",
      assigneeId: task.assigneeId,
    });
  }

  return overdueTasks.length;
}

export function startOverdueScheduler() {
  // every 5 minutes is frequent enough to feel live without hammering the DB
  cron.schedule("*/5 * * * *", async () => {
    const count = await markOverdueTasks();
    if (count > 0) {
      console.log(`[overdue-scheduler] flagged ${count} task(s) as OVERDUE`);
    }
  });
}
