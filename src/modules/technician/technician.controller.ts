import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { technicianService, technicianServiceCrud } from "./technician.service";

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

// ---------------- Services ----------------

const listServices = catchAsync(async (req, res) => {
  const data = await technicianServiceCrud.listMyServices(req.user!.id);
  sendResponse(res, { message: "Your services fetched", data });
});

const createService = catchAsync(async (req, res) => {
  const data = await technicianServiceCrud.createService(req.user!.id, req.body);
  sendResponse(res, { statusCode: 201, message: "Service created successfully", data });
});

const updateService = catchAsync(async (req, res) => {
  const data = await technicianServiceCrud.updateService(req.user!.id, req.params.id, req.body);
  sendResponse(res, { message: "Service updated successfully", data });
});

const deleteService = catchAsync(async (req, res) => {
  const result = await technicianServiceCrud.deleteService(req.user!.id, req.params.id);
  sendResponse(res, {
    message: result.archived
      ? "Service has past bookings, so it was deactivated instead of deleted"
      : "Service deleted successfully",
    data: result,
  });
});

export const technicianServiceController = { listServices, createService, updateService, deleteService };
