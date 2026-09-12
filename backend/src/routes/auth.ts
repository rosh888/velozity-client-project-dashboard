import { Router } from "express";
import { login, logout, me, refresh } from "../controllers/authController";
import { authenticate } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { loginSchema } from "../validation/auth";

const router = Router();

router.post("/login", validateBody(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authenticate, me);

export default router;
