import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { browseService } from "./browse.service";

const listServices = catchAsync(async (req, res) => {
  const { data, meta } = await browseService.listServices(req.query as never);
  sendResponse(res, { message: "Services fetched successfully", data, meta });
});

const getService = catchAsync(async (req, res) => {
  const data = await browseService.getService(req.params.id);
  sendResponse(res, { message: "Service fetched successfully", data });
});

const listTechnicians = catchAsync(async (req, res) => {
  const { data, meta } = await browseService.listTechnicians(req.query as never);
  sendResponse(res, { message: "Technicians fetched successfully", data, meta });
});

const getTechnician = catchAsync(async (req, res) => {
  const data = await browseService.getTechnician(req.params.id);
  sendResponse(res, { message: "Technician profile fetched successfully", data });
});

export const browseController = { listServices, getService, listTechnicians, getTechnician };
