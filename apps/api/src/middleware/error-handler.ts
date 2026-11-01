
import type {
  ErrorRequestHandler,
  RequestHandler,
} from "express";

import { HttpError } from "../utils/http-error.js";

export const notFound: RequestHandler = (
  _req,
  _res,
  next,
) => {
  next(new HttpError(404, "Route not found"));
};

type BodyParserError = {
  status?: number;
  statusCode?: number;
  type?: string;
};

function isMalformedJsonError(
  error: unknown,
): error is BodyParserError {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return false;
  }

  const candidate = error as BodyParserError;

  return (
    candidate.type === "entity.parse.failed" &&
    (candidate.status === 400 ||
      candidate.statusCode === 400)
  );
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next,
) => {
  // Invalid JSON sent by the client.
  if (isMalformedJsonError(error)) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Malformed JSON request body",
      },
    });
    return;
  }

  // Known application errors, including 401 / 403 / 404.
  if (error instanceof HttpError) {
    const status =
      error.status >= 400 && error.status < 600
        ? error.status
        : 500;

    if (status === 500) {
      console.error("Unhandled API error:", error);

      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error",
        },
      });
      return;
    }

    res.status(status).json({
      success: false,
      error: {
        code:
          status === 404
            ? "NOT_FOUND"
            : status === 403
              ? "FORBIDDEN"
              : status === 401
                ? "UNAUTHORIZED"
                : "REQUEST_ERROR",
        message: error.message,
      },
    });
    return;
  }

  // Unexpected errors must not expose internal details.
  console.error("Unhandled API error:", error);

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    },
  });
};
