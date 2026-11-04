export type AttendanceStatus = "PRESENT" | "ABSENT";

export type SessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

// Dates are ISO datetime strings in API JSON responses.
export interface SessionListItem {
  id: string;
  classId: string;
  scheduleId: string | null;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  attendanceCount: number;
}

export interface SessionListParams {
  page?: number;
  limit?: number;
  status?: SessionStatus;
  /** Inclusive startsAt bound; ISO datetime with a timezone offset. */
  from?: string;
  /** Inclusive startsAt bound; ISO datetime with a timezone offset. */
  to?: string;
}

export interface SessionListData {
  items: SessionListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AttendanceSession {
  id: string;
  classId: string;
  className: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
}

export interface AttendanceStudent {
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  fullName: string;
  /** null means there is no attendance record for this enrollment/session. */
  attendanceStatus: AttendanceStatus | null;
  note: string | null;
  markedAt: string | null;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  unmarked: number;
}

export interface SessionAttendanceData {
  session: AttendanceSession;
  students: AttendanceStudent[];
  summary: AttendanceSummary;
}

export interface AttendanceRecordInput {
  enrollmentId: string;
  status: AttendanceStatus;
}

export interface UpdateAttendancePayload {
  /** 1–200 unique enrollment IDs; omitted enrollments remain unchanged. */
  records: AttendanceRecordInput[];
}

export interface UpdateAttendanceData {
  sessionId: string;
  updatedCount: number;
  markedAt: string;
  records: AttendanceRecordInput[];
}

export interface CompleteSessionData {
  sessionId: string;
  classId: string;
  status: "COMPLETED";
  summary: AttendanceSummary & { unmarked: 0 };
}
