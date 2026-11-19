import { Router } from "express";
import { authenticate, authorize } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { reviewController } from "./review.controller";
import { createReviewSchema } from "./review.validation";

const router = Router();

router.post("/", authenticate, authorize("CUSTOMER"), validate({ body: createReviewSchema }), reviewController.create);

export default router;
