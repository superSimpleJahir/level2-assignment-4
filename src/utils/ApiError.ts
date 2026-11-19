// A single error type we throw from services/controllers.
// The global error handler turns it into the structured JSON response.
export class ApiError extends Error {
  statusCode: number;
  errorDetails: unknown;

  constructor(statusCode: number, message: string, errorDetails: unknown = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorDetails = errorDetails;
    Object.setPrototypeOf(this, ApiError.prototype);
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = "Authentication required") {
    return new ApiError(401, message);
  }
  static forbidden(message = "You do not have permission to perform this action") {
    return new ApiError(403, message);
  }
  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }
  static conflict(message: string, details?: unknown) {
    return new ApiError(409, message, details);
  }
}
