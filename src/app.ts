import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import { paymentController } from "./modules/payments/payment.controller";
import routes from "./routes";

const app = express();

// Needed on Vercel/Render so rate limiting sees the real client IP
app.set("trust proxy", 1);

app.use(
  helmet({
    // Otherwise Safari tries to load Swagger UI assets over https on http://localhost
    contentSecurityPolicy: { directives: { "upgrade-insecure-requests": null } },
  }),
);
app.use(cors());
if (env.NODE_ENV !== "test") app.use(morgan("dev"));

// Stripe signs the exact raw bytes, so this route must be registered
// BEFORE express.json() parses (and changes) the body.
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), paymentController.webhook);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests, please try again later", errorDetails: null },
  }),
);

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Welcome to the FixItNow API",
    data: { docs: "/api/docs", health: "/api/health" },
  });
});

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

export default app;
