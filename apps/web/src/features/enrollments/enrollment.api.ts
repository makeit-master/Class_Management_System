import { apiClient } from "../../lib/api-client";

import type {
  CreateEnrollmentData,
  CreateEnrollmentPayload,
  DropEnrollmentData,
  EnrollmentListData,
  EnrollmentListParams,
} from "./enrollment.types";

// Reuse the shared API error class.
// Existing UI imports remain compatible.
export { ApiError as EnrollmentApiError } from "../../lib/api-client";

// ============================================================
// GET ENROLLMENTS
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

  return apiClient<EnrollmentListData>(`/enrollments?${query.toString()}`, {
    method: "GET",
    token,
  });
}

// ============================================================
// CREATE OR REACTIVATE ENROLLMENT
// ============================================================

export async function createEnrollment(
  payload: CreateEnrollmentPayload,
  token: string,
): Promise<CreateEnrollmentData> {
  return apiClient<CreateEnrollmentData>("/enrollments", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

// ============================================================
// DROP ENROLLMENT
// ============================================================

export async function dropEnrollment(
  enrollmentId: string,
  token: string,
): Promise<DropEnrollmentData> {
  return apiClient<DropEnrollmentData>(
    `/enrollments/${encodeURIComponent(enrollmentId)}/drop`,
    {
      method: "PATCH",
      token,
    },
  );
}
