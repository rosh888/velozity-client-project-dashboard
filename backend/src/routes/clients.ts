import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { createClientSchema } from "../validation/client";
import { createClient, listClients } from "../controllers/clientController";

const router = Router();

router.use(authenticate);

router.get("/", requireRole("ADMIN", "PROJECT_MANAGER"), listClients);
router.post("/", requireRole("ADMIN"), validateBody(createClientSchema), createClient);

export default router;
