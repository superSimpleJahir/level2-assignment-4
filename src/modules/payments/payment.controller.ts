import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { paymentService } from "./payment.service";

const create = catchAsync(async (req, res) => {
  const data = await paymentService.createCheckout(req.user!.id, req.body.bookingId);
  sendResponse(res, {
    statusCode: 201,
    message: "Checkout session created. Redirect the customer to checkoutUrl to pay.",
    data,
  });
});

const confirm = catchAsync(async (req, res) => {
  const data = await paymentService.confirm(req.user!.id, req.body.sessionId);
  sendResponse(res, { message: "Payment confirmed. Your booking is now paid.", data });
});

// Mounted in app.ts with express.raw(), req.body is a Buffer here
const webhook = catchAsync(async (req, res) => {
  const result = await paymentService.handleWebhook(req.body, req.headers["stripe-signature"] as string | undefined);
  res.status(200).json({ success: true, message: "Webhook processed", data: result });
});

const list = catchAsync(async (req, res) => {
  const { data, meta } = await paymentService.list(req.user!, req.query as never);
  sendResponse(res, { message: "Payments fetched successfully", data, meta });
});

const getById = catchAsync(async (req, res) => {
  const data = await paymentService.getById(req.user!, req.params.id);
  sendResponse(res, { message: "Payment fetched successfully", data });
});

export const paymentController = { create, confirm, webhook, list, getById };
