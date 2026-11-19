import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { reviewService } from "./review.service";

const create = catchAsync(async (req, res) => {
  const data = await reviewService.create(req.user!.id, req.body);
  sendResponse(res, { statusCode: 201, message: "Thanks! Your review has been submitted.", data });
});

export const reviewController = { create };
