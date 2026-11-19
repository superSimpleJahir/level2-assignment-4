import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { bookingService } from "./booking.service";

const create = catchAsync(async (req, res) => {
  const data = await bookingService.create(req.user!.id, req.body);
  sendResponse(res, { statusCode: 201, message: "Booking requested. Waiting for the technician to respond.", data });
});

const list = catchAsync(async (req, res) => {
  const { data, meta } = await bookingService.listForUser(req.user!, req.query as never);
  sendResponse(res, { message: "Bookings fetched successfully", data, meta });
});

const getById = catchAsync(async (req, res) => {
  const data = await bookingService.getById(req.user!, req.params.id);
  sendResponse(res, { message: "Booking fetched successfully", data });
});

const cancel = catchAsync(async (req, res) => {
  const data = await bookingService.cancel(req.user!.id, req.params.id);
  sendResponse(res, { message: "Booking cancelled", data });
});

export const bookingController = { create, list, getById, cancel };
