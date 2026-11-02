import type {
  ApiErrorResponse,
  ApiSuccess,
  EnrollmentListData,
  EnrollmentListParams,
  CreateEnrollmentPayload,
  CreateEnrollmentData,
  DropEnrollmentData,
} from "./enrollment.types";

// Set VITE_API_BASE_URL to API origin.
// Example: http://127.0.0.1:3000
// When omitted, requests use same-origin /api.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
  /\/+$/,
  "",
);

export class EnrollmentApiError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);

    this.name = "EnrollmentApiError";
    this.status = status;
    this.code = code;
  }
}

async function enrollmentRequest<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  if (!token.trim()) {
    throw new EnrollmentApiError(
      401,
      "UNAUTHORIZED",
      "Authentication required",
    );
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/enrollments${path}`, {
      ...options,
      headers: {
        ...(options.body != null ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new EnrollmentApiError(
      0,
      "NETWORK_ERROR",
      "Cannot connect to the server",
    );
  }

  let body: ApiSuccess<T> | ApiErrorResponse;

  try {
    body = (await response.json()) as ApiSuccess<T> | ApiErrorResponse;
  } catch {
    throw new EnrollmentApiError(
      response.status,
      "INVALID_RESPONSE",
      "Server returned an invalid response",
    );
  }

  if (!response.ok || !body.success) {
    const error = !body.success ? body.error : null;

    throw new EnrollmentApiError(
      response.status,
      error?.code ?? "REQUEST_FAILED",
      error?.message ?? "Request failed",
    );
  }

  return body.data;
}

// ============================================================
// M17.4.1 - GET ENROLLMENTS
// ============================================================

export async function getEnrollments(
  params: EnrollmentListParams,
  token: string,
): Promise<EnrollmentListData> {
  const query = new URLSearchParams({
    classId: params.classId,
    status: params.status ?? "ACTIVE",
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  });

  return enrollmentRequest<EnrollmentListData>(`?${query.toString()}`, token, {
    method: "GET",
  });
}

// ============================================================
// M17.4.1 - CREATE OR REACTIVATE ENROLLMENT
// ============================================================

export async function createEnrollment(
  payload: CreateEnrollmentPayload,
  token: string,
): Promise<CreateEnrollmentData> {
  return enrollmentRequest<CreateEnrollmentData>("", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ============================================================
// M17.4.1 - DROP ENROLLMENT
// ============================================================

export async function dropEnrollment(
  enrollmentId: string,
  token: string,
): Promise<DropEnrollmentData> {
  return enrollmentRequest<DropEnrollmentData>(
    `/${encodeURIComponent(enrollmentId)}/drop`,
    token,
    { method: "PATCH" },
  );
}
