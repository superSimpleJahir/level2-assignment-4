import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { categoryService } from "./category.service";

const getPublic = catchAsync(async (_req, res) => {
  const data = await categoryService.getPublic();
  sendResponse(res, { message: "Categories fetched successfully", data });
});

const getAll = catchAsync(async (_req, res) => {
  const data = await categoryService.getAll();
  sendResponse(res, { message: "All categories fetched successfully", data });
});

const create = catchAsync(async (req, res) => {
  const data = await categoryService.create(req.body);
  sendResponse(res, { statusCode: 201, message: "Category created successfully", data });
});

const update = catchAsync(async (req, res) => {
  const data = await categoryService.update(req.params.id, req.body);
  sendResponse(res, { message: "Category updated successfully", data });
});

const remove = catchAsync(async (req, res) => {
  await categoryService.remove(req.params.id);
  sendResponse(res, { message: "Category deleted successfully" });
});

export const categoryController = { getPublic, getAll, create, update, remove };
