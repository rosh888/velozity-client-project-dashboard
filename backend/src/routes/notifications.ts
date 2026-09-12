import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { listNotifications, markAllRead, markRead } from "../controllers/notificationController";

const router = Router();

router.use(authenticate);

router.get("/", listNotifications);
router.patch("/read-all", markAllRead);
router.patch("/:id/read", markRead);

export default router;
