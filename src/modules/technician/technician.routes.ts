import { Router } from "express";
import { authenticate, authorize } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { technicianController } from "./technician.controller";
import { availabilitySchema, updateProfileSchema } from "./technician.validation";

const router = Router();

// Everything under /api/technician is for logged-in technicians only
router.use(authenticate, authorize("TECHNICIAN"));

router.get("/profile", technicianController.getMyProfile);
router.put("/profile", validate({ body: updateProfileSchema }), technicianController.updateProfile);
router.put("/availability", validate({ body: availabilitySchema }), technicianController.setAvailability);

export default router;
