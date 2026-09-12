import { PrismaClient, Priority, TaskStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
  OVERDUE: "Overdue",
};

async function hash(password: string) {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log("Seeding...");

  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      name: "Anita Sharma",
      email: "admin@velozity.com",
      passwordHash: await hash("Admin@2026"),
      role: "ADMIN",
    },
  });

  const pm1 = await prisma.user.create({
    data: {
      name: "Rohan Mehta",
      email: "pm1@velozity.com",
      passwordHash: await hash("Manager@2026"),
      role: "PROJECT_MANAGER",
    },
  });

  const pm2 = await prisma.user.create({
    data: {
      name: "Priya Nair",
      email: "pm2@velozity.com",
      passwordHash: await hash("Manager@2027"),
      role: "PROJECT_MANAGER",
    },
  });

  const devNames = [
    ["Ravi Kumar", "dev1@velozity.com", "Developer@2026"],
    ["Sara Iyer", "dev2@velozity.com", "Developer@2027"],
    ["Karan Verma", "dev3@velozity.com", "Developer@2028"],
    ["Meera Joshi", "dev4@velozity.com", "Developer@2029"],
  ] as const;

  const developers = [];
  for (const [name, email, password] of devNames) {
    developers.push(
      await prisma.user.create({
        data: { name, email, passwordHash: await hash(password), role: "DEVELOPER" },
      })
    );
  }
  const [dev1, dev2, dev3, dev4] = developers;

  const clientAcme = await prisma.client.create({
    data: { name: "Acme Retail Group", email: "contact@acmeretail.com" },
  });
  const clientBright = await prisma.client.create({
    data: { name: "Bright Health Systems", email: "ops@brighthealth.com" },
  });
  const clientNimbus = await prisma.client.create({
    data: { name: "Nimbus Logistics", email: "hello@nimbuslogistics.com" },
  });

  const projectWebsite = await prisma.project.create({
    data: {
      name: "Website Redesign",
      description: "Rebuild the marketing site with a new design system.",
      clientId: clientAcme.id,
      ownerId: pm1.id,
    },
  });

  const projectMobile = await prisma.project.create({
    data: {
      name: "Patient Portal Mobile App",
      description: "Native mobile app for appointment booking and records.",
      clientId: clientBright.id,
      ownerId: pm1.id,
    },
  });

  const projectInventory = await prisma.project.create({
    data: {
      name: "Inventory System Migration",
      description: "Migrate legacy warehouse inventory tooling to the new stack.",
      clientId: clientNimbus.id,
      ownerId: pm2.id,
    },
  });

  type TaskSeed = {
    title: string;
    description: string;
    assignee: (typeof developers)[number] | null;
    status: TaskStatus;
    priority: Priority;
    dueDate: Date | null;
  };

  async function seedTasksForProject(projectId: string, ownerId: string, tasks: TaskSeed[]) {
    for (const t of tasks) {
      const task = await prisma.task.create({
        data: {
          title: t.title,
          description: t.description,
          projectId,
          assigneeId: t.assignee?.id ?? null,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
        },
      });

      await prisma.activityLog.create({
        data: {
          taskId: task.id,
          projectId,
          actorId: ownerId,
          toStatus: "TODO",
          message: `${t.assignee ? "Task created and assigned" : "Task created"}: "${task.title}"`,
          createdAt: daysFromNow(-6),
        },
      });

      if (t.status !== "TODO") {
        await prisma.activityLog.create({
          data: {
            taskId: task.id,
            projectId,
            actorId: t.assignee?.id ?? ownerId,
            fromStatus: "TODO",
            toStatus: t.status,
            message: `${(t.assignee ?? admin).name} moved "${task.title}" from To Do → ${STATUS_LABEL[t.status]}`,
            createdAt: daysFromNow(-2),
          },
        });
      }

      if (t.assignee) {
        await prisma.notification.create({
          data: {
            userId: t.assignee.id,
            taskId: task.id,
            type: "TASK_ASSIGNED",
            message: `You were assigned to "${task.title}"`,
            createdAt: daysFromNow(-6),
          },
        });
      }

      if (t.status === "IN_REVIEW") {
        await prisma.notification.create({
          data: {
            userId: ownerId,
            taskId: task.id,
            type: "TASK_IN_REVIEW",
            message: `"${task.title}" was moved to In Review`,
            createdAt: daysFromNow(-1),
          },
        });
      }
    }
  }

  await seedTasksForProject(projectWebsite.id, pm1.id, [
    {
      title: "Set up design tokens",
      description: "Define color, spacing and typography tokens for the new design system.",
      assignee: dev1,
      status: "DONE",
      priority: Priority.MEDIUM,
      dueDate: daysFromNow(-10),
    },
    {
      title: "Build homepage hero section",
      description: "Implement the responsive hero section from Figma.",
      assignee: dev1,
      status: "IN_PROGRESS",
      priority: Priority.HIGH,
      dueDate: daysFromNow(5),
    },
    {
      title: "Wire up contact form",
      description: "Connect the contact form to the CRM webhook.",
      assignee: dev2,
      status: "IN_REVIEW",
      priority: Priority.MEDIUM,
      dueDate: daysFromNow(3),
    },
    {
      title: "Fix mobile nav overlap",
      description: "Nav menu overlaps hero content below 380px width.",
      assignee: dev2,
      status: "TODO",
      priority: Priority.LOW,
      dueDate: daysFromNow(9),
    },
    {
      title: "SEO metadata pass",
      description: "Add missing meta descriptions and OG tags across pages.",
      assignee: dev1,
      status: "OVERDUE",
      priority: Priority.CRITICAL,
      dueDate: daysFromNow(-3),
    },
    {
      title: "Accessibility audit",
      description: "Run an automated + manual a11y pass on the new pages.",
      assignee: null,
      status: "TODO",
      priority: Priority.MEDIUM,
      dueDate: daysFromNow(14),
    },
  ]);

  await seedTasksForProject(projectMobile.id, pm1.id, [
    {
      title: "Appointment booking flow",
      description: "Multi-step booking screens with slot availability.",
      assignee: dev3,
      status: "IN_PROGRESS",
      priority: Priority.HIGH,
      dueDate: daysFromNow(6),
    },
    {
      title: "Push notification setup",
      description: "Integrate FCM/APNs for appointment reminders.",
      assignee: dev3,
      status: "TODO",
      priority: Priority.MEDIUM,
      dueDate: daysFromNow(12),
    },
    {
      title: "Biometric login",
      description: "Add Face ID / fingerprint unlock for returning patients.",
      assignee: dev4,
      status: "IN_REVIEW",
      priority: Priority.HIGH,
      dueDate: daysFromNow(2),
    },
    {
      title: "Records download as PDF",
      description: "Let patients export visit summaries.",
      assignee: dev4,
      status: "DONE",
      priority: Priority.LOW,
      dueDate: daysFromNow(-8),
    },
    {
      title: "Offline mode for appointment list",
      description: "Cache the upcoming appointments list for offline viewing.",
      assignee: dev3,
      status: "OVERDUE",
      priority: Priority.CRITICAL,
      dueDate: daysFromNow(-2),
    },
  ]);

  await seedTasksForProject(projectInventory.id, pm2.id, [
    {
      title: "Data migration script",
      description: "Write and dry-run the legacy-to-new schema migration.",
      assignee: dev2,
      status: "IN_PROGRESS",
      priority: Priority.CRITICAL,
      dueDate: daysFromNow(4),
    },
    {
      title: "Barcode scanner integration",
      description: "Support handheld scanner input in the receiving workflow.",
      assignee: dev4,
      status: "TODO",
      priority: Priority.MEDIUM,
      dueDate: daysFromNow(10),
    },
    {
      title: "Warehouse dashboard",
      description: "Stock-level overview dashboard for warehouse managers.",
      assignee: dev1,
      status: "TODO",
      priority: Priority.HIGH,
      dueDate: daysFromNow(15),
    },
    {
      title: "Low-stock alert emails",
      description: "Send email alerts when SKU quantity drops below threshold.",
      assignee: dev2,
      status: "DONE",
      priority: Priority.MEDIUM,
      dueDate: daysFromNow(-5),
    },
    {
      title: "Supplier API sync",
      description: "Nightly sync job with supplier stock feeds.",
      assignee: null,
      status: "TODO",
      priority: Priority.LOW,
      dueDate: daysFromNow(20),
    },
  ]);

  console.log("Seed complete.");
  console.log({
    admin: admin.email,
    projectManagers: [pm1.email, pm2.email],
    developers: developers.map((d) => d.email),
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
