import { Router } from "express";
import { authenticate, authorize } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { idParamSchema } from "../../utils/commonSchemas";
import { bookingController } from "./booking.controller";
import { bookingQuerySchema, createBookingSchema } from "./booking.validation";

const router = Router();

router.use(authenticate);

router.post("/", authorize("CUSTOMER"), validate({ body: createBookingSchema }), bookingController.create);
router.get("/", authorize("CUSTOMER", "TECHNICIAN"), validate({ query: bookingQuerySchema }), bookingController.list);
router.get("/:id", validate({ params: idParamSchema }), bookingController.getById);
router.patch("/:id/cancel", authorize("CUSTOMER"), validate({ params: idParamSchema }), bookingController.cancel);

export default router;
