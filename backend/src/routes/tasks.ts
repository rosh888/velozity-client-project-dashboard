import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { validateBody, validateParams, validateQuery } from "../middleware/validate";
import { idParamSchema } from "../validation/project";
import {
  createTaskSchema,
  taskFilterSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from "../validation/task";
import {
  createTask,
  getTask,
  listTasks,
  updateTask,
  updateTaskStatus,
} from "../controllers/taskController";

const router = Router();

router.use(authenticate);

router.get("/", validateQuery(taskFilterSchema), listTasks);
router.post(
  "/",
  requireRole("ADMIN", "PROJECT_MANAGER"),
  validateBody(createTaskSchema),
  createTask
);
router.get("/:id", validateParams(idParamSchema), getTask);
router.patch(
  "/:id",
  requireRole("ADMIN", "PROJECT_MANAGER"),
  validateParams(idParamSchema),
  validateBody(updateTaskSchema),
  updateTask
);
router.patch(
  "/:id/status",
  validateParams(idParamSchema),
  validateBody(updateTaskStatusSchema),
  updateTaskStatus
);

export default router;
