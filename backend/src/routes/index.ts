import { Router } from "express";
import authRoutes from "./auth";
import projectRoutes from "./projects";
import taskRoutes from "./tasks";
import clientRoutes from "./clients";
import notificationRoutes from "./notifications";
import activityRoutes from "./activity";
import dashboardRoutes from "./dashboard";
import userRoutes from "./users";

const router = Router();

router.use("/auth", authRoutes);
router.use("/projects", projectRoutes);
router.use("/tasks", taskRoutes);
router.use("/clients", clientRoutes);
router.use("/notifications", notificationRoutes);
router.use("/activity", activityRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/users", userRoutes);

export default router;
