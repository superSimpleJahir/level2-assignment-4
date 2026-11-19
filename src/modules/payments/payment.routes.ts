import { Router } from "express";
import { authenticate, authorize } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { paymentController } from "./payment.controller";
import { confirmPaymentSchema, createPaymentSchema } from "./payment.validation";

const router = Router();

router.use(authenticate);

router.post("/create", authorize("CUSTOMER"), validate({ body: createPaymentSchema }), paymentController.create);
router.post("/confirm", authorize("CUSTOMER"), validate({ body: confirmPaymentSchema }), paymentController.confirm);

export default router;
