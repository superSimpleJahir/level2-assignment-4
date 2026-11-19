import { Router } from "express";
import { authenticate, authorize } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { paymentController } from "./payment.controller";
import { idParamSchema } from "../../utils/commonSchemas";
import { confirmPaymentSchema, createPaymentSchema, paymentQuerySchema } from "./payment.validation";

const router = Router();

router.use(authenticate);

router.post("/create", authorize("CUSTOMER"), validate({ body: createPaymentSchema }), paymentController.create);
router.post("/confirm", authorize("CUSTOMER"), validate({ body: confirmPaymentSchema }), paymentController.confirm);
router.get("/", authorize("CUSTOMER", "TECHNICIAN"), validate({ query: paymentQuerySchema }), paymentController.list);
router.get("/:id", validate({ params: idParamSchema }), paymentController.getById);

export default router;
