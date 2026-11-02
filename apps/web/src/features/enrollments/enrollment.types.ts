export type EnrollmentStatus = "ACTIVE" | "DROPPED";

export interface EnrollmentStudent {
  id: string;
  studentCode: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  archivedAt: string | null;
}

export interface EnrollmentListItem {
  id: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  student: EnrollmentStudent;
}

export interface EnrollmentClass {
  id: string;
  name: string;
  subject: string;
}

export interface EnrollmentPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface EnrollmentListData {
  class: EnrollmentClass;
  items: EnrollmentListItem[];
  pagination: EnrollmentPagination;
}

export interface EnrollmentListParams {
  classId: string;
  status?: EnrollmentStatus;
  page?: number;
  limit?: number;
}

export interface EnrollmentRecord {
  id: string;
  studentId: string;
  classId: string;
  status: EnrollmentStatus;
  enrolledAt: string;
}

export interface CreateEnrollmentPayload {
  studentId: string;
  classId: string;
}

export interface CreateEnrollmentData {
  enrollment: EnrollmentRecord;
  reactivated: boolean;
}

export interface DropEnrollmentData {
  enrollment: EnrollmentRecord;
}

// Shared API response structure
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
