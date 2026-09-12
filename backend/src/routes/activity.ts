import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validateQuery } from "../middleware/validate";
import { activityQuerySchema } from "../validation/activity";
import { listActivity } from "../controllers/activityController";

const router = Router();

router.use(authenticate);
router.get("/", validateQuery(activityQuerySchema), listActivity);

export default router;
