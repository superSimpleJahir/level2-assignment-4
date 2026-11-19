import { Router } from "express";
import { validate } from "../../middlewares/validate";
import { idParamSchema } from "../../utils/commonSchemas";
import { browseController } from "./browse.controller";
import { serviceQuerySchema, technicianQuerySchema } from "./browse.validation";

// Public routes - no login needed
export const serviceRoutes = Router();
serviceRoutes.get("/", validate({ query: serviceQuerySchema }), browseController.listServices);
serviceRoutes.get("/:id", validate({ params: idParamSchema }), browseController.getService);

export const technicianBrowseRoutes = Router();
technicianBrowseRoutes.get("/", validate({ query: technicianQuerySchema }), browseController.listTechnicians);
technicianBrowseRoutes.get("/:id", validate({ params: idParamSchema }), browseController.getTechnician);
