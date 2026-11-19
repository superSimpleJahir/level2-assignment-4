import { Router } from "express";
import { authenticate, authorize } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { categoryController } from "./category.controller";
import { createCategorySchema, idParamSchema, updateCategorySchema } from "./category.validation";

// GET /api/categories
export const publicCategoryRoutes = Router();
publicCategoryRoutes.get("/", categoryController.getPublic);

// /api/admin/categories
export const adminCategoryRoutes = Router();
adminCategoryRoutes.use(authenticate, authorize("ADMIN"));
adminCategoryRoutes.get("/", categoryController.getAll);
adminCategoryRoutes.post("/", validate({ body: createCategorySchema }), categoryController.create);
adminCategoryRoutes.put(
  "/:id",
  validate({ params: idParamSchema, body: updateCategorySchema }),
  categoryController.update,
);
adminCategoryRoutes.delete("/:id", validate({ params: idParamSchema }), categoryController.remove);
