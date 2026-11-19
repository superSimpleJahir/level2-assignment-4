import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { authService } from "./auth.service";

const register = catchAsync(async (req, res) => {
  const result = await authService.register(req.body);
  sendResponse(res, { statusCode: 201, message: "Account created successfully", data: result });
});

const login = catchAsync(async (req, res) => {
  const result = await authService.login(req.body.email, req.body.password);
  sendResponse(res, { message: "Logged in successfully", data: result });
});

const getMe = catchAsync(async (req, res) => {
  const user = await authService.getMe(req.user!.id);
  sendResponse(res, { message: "Current user fetched", data: user });
});

const updateMe = catchAsync(async (req, res) => {
  const user = await authService.updateMe(req.user!.id, req.body);
  sendResponse(res, { message: "Profile updated successfully", data: user });
});

const changePassword = catchAsync(async (req, res) => {
  await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
  sendResponse(res, { message: "Password changed successfully" });
});

export const authController = { register, login, getMe, updateMe, changePassword };
