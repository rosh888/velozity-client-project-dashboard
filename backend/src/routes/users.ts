import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { createUserSchema } from "../validation/user";
import { createUser, listUsers } from "../controllers/userController";

const router = Router();

router.use(authenticate, requireRole("ADMIN", "PROJECT_MANAGER"));

router.get("/", listUsers);
router.post("/", requireRole("ADMIN"), validateBody(createUserSchema), createUser);

export default router;
