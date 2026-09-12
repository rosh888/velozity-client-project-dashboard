import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { validateBody, validateParams } from "../middleware/validate";
import { createProjectSchema, idParamSchema, updateProjectSchema } from "../validation/project";
import { createProject, getProject, listProjects, updateProject } from "../controllers/projectController";

const router = Router();

router.use(authenticate);

router.get("/", requireRole("ADMIN", "PROJECT_MANAGER"), listProjects);
router.post(
  "/",
  requireRole("ADMIN", "PROJECT_MANAGER"),
  validateBody(createProjectSchema),
  createProject
);
router.get("/:id", validateParams(idParamSchema), getProject);
router.patch(
  "/:id",
  requireRole("ADMIN", "PROJECT_MANAGER"),
  validateParams(idParamSchema),
  validateBody(updateProjectSchema),
  updateProject
);

export default router;
