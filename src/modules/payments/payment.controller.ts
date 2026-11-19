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

export const paymentController = { create };
