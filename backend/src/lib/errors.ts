export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export const Errors = {
  unauthorized: (message = "Authentication required") => new AppError("UNAUTHORIZED", message),
  forbidden: (message = "You do not have permission to perform this action") =>
    new AppError("FORBIDDEN", message),
  notFound: (message = "Resource not found") => new AppError("NOT_FOUND", message),
  conflict: (message: string) => new AppError("CONFLICT", message),
  badRequest: (message: string) => new AppError("BAD_REQUEST", message),
};
