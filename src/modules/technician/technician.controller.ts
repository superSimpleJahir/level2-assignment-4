import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { technicianService } from "./technician.service";

const getMyProfile = catchAsync(async (req, res) => {
  const data = await technicianService.getMyProfile(req.user!.id);
  sendResponse(res, { message: "Technician profile fetched", data });
});

const updateProfile = catchAsync(async (req, res) => {
  const data = await technicianService.updateProfile(req.user!.id, req.body);
  sendResponse(res, { message: "Technician profile updated", data });
});

const setAvailability = catchAsync(async (req, res) => {
  const data = await technicianService.setAvailability(req.user!.id, req.body.slots);
  sendResponse(res, { message: "Availability updated", data });
});

export const technicianController = { getMyProfile, updateProfile, setAvailability };
