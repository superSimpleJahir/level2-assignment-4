import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { adminService } from "./admin.service";

const listUsers = catchAsync(async (req, res) => {
  const { data, meta } = await adminService.listUsers(req.query as never);
  sendResponse(res, { message: "Users fetched successfully", data, meta });
});

const updateUserStatus = catchAsync(async (req, res) => {
  const data = await adminService.updateUserStatus(req.user!.id, req.params.id, req.body.status);
  sendResponse(res, { message: `User status changed to ${data.status}`, data });
});

const listBookings = catchAsync(async (req, res) => {
  const { data, meta } = await adminService.listBookings(req.query as never);
  sendResponse(res, { message: "Bookings fetched successfully", data, meta });
});

const listPayments = catchAsync(async (req, res) => {
  const { data, meta } = await adminService.listPayments(req.query as never);
  sendResponse(res, { message: "Payments fetched successfully", data, meta });
});

export const adminController = { listUsers, updateUserStatus, listBookings, listPayments };
