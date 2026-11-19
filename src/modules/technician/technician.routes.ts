import { Router } from "express";
import { authenticate, authorize } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { idParamSchema } from "../../utils/commonSchemas";
import { technicianController, technicianServiceController } from "./technician.controller";
import { availabilitySchema, createServiceSchema, updateProfileSchema, updateServiceSchema } from "./technician.validation";

const router = Router();

// Everything under /api/technician is for logged-in technicians only
router.use(authenticate, authorize("TECHNICIAN"));

router.get("/profile", technicianController.getMyProfile);
router.put("/profile", validate({ body: updateProfileSchema }), technicianController.updateProfile);
router.put("/availability", validate({ body: availabilitySchema }), technicianController.setAvailability);

router.get("/services", technicianServiceController.listServices);
router.post("/services", validate({ body: createServiceSchema }), technicianServiceController.createService);
router.put(
  "/services/:id",
  validate({ params: idParamSchema, body: updateServiceSchema }),
  technicianServiceController.updateService,
);
router.delete("/services/:id", validate({ params: idParamSchema }), technicianServiceController.deleteService);

export default router;
