import type { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError } from "../utils/http-error.js";

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, "Route not found"));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  const known = error instanceof HttpError;
  const status = known && error.status >= 400 && error.status < 600 ? error.status : 500;
  if (status === 500) console.error("Unhandled API error:", error);
  res.status(status).json({
    success: false,
    error: { code: status === 404 ? "NOT_FOUND" : status === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR", message: known ? error.message : "Internal server error" },
  });
};
