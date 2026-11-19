import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import bookingRoutes, { technicianBookingRoutes } from "../modules/bookings/booking.routes";
import { serviceRoutes, technicianBrowseRoutes } from "../modules/browse/browse.routes";
import paymentRoutes from "../modules/payments/payment.routes";
import reviewRoutes from "../modules/reviews/review.routes";
import technicianRoutes from "../modules/technician/technician.routes";
import { adminCategoryRoutes, publicCategoryRoutes } from "../modules/categories/category.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "FixItNow API is healthy",
    data: { uptime: process.uptime(), timestamp: new Date().toISOString() },
  });
});

router.use("/auth", authRoutes);
router.use("/categories", publicCategoryRoutes);
router.use("/admin/categories", adminCategoryRoutes);
router.use("/services", serviceRoutes);
router.use("/technicians", technicianBrowseRoutes);
router.use("/technician/bookings", technicianBookingRoutes);
router.use("/technician", technicianRoutes);
router.use("/bookings", bookingRoutes);
router.use("/payments", paymentRoutes);
router.use("/reviews", reviewRoutes);

export default router;
