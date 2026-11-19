import { Router } from "express";
import { authenticate, authorize } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { idParamSchema } from "../../utils/commonSchemas";
import { adminCategoryRoutes } from "../categories/category.routes";
import { adminController } from "./admin.controller";
import {
  adminBookingQuerySchema,
  adminPaymentQuerySchema,
  adminUserQuerySchema,
  updateUserStatusSchema,
} from "./admin.validation";

const router = Router();

router.use(authenticate, authorize("ADMIN"));

router.get("/users", validate({ query: adminUserQuerySchema }), adminController.listUsers);
router.patch(
  "/users/:id",
  validate({ params: idParamSchema, body: updateUserStatusSchema }),
  adminController.updateUserStatus,
);
router.get("/bookings", validate({ query: adminBookingQuerySchema }), adminController.listBookings);
router.get("/payments", validate({ query: adminPaymentQuerySchema }), adminController.listPayments);

// /api/admin/categories
router.use("/categories", adminCategoryRoutes);

export default router;
