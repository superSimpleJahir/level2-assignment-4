import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "./openapi";

const router = Router();

// Raw spec - handy for importing into Postman or Insomnia
router.get("/docs.json", (_req, res) => {
  res.json(openApiSpec);
});

router.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: "FixItNow API Docs",
    swaggerOptions: { persistAuthorization: true },
  }),
);

export default router;
