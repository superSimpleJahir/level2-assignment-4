import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { authController } from "./auth.controller";
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from "./auth.validation";

const router = Router();

// Slow down brute-force attempts on login/register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts, please try again later", errorDetails: null },
});

router.post("/register", authLimiter, validate({ body: registerSchema }), authController.register);
router.post("/login", authLimiter, validate({ body: loginSchema }), authController.login);
router.get("/me", authenticate, authController.getMe);

export default router;
