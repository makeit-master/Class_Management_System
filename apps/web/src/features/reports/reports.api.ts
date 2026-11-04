import { apiClient } from "../../lib/api-client";

export type MonthlyAttendanceRow = {
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  fullName: string;
  enrollmentStatus: "ACTIVE" | "DROPPED";
  eligibleSessions: number;
  present: number;
  absent: number;
  unmarked: number;
  attendanceRate: number | null;
};

export type MonthlyAttendanceReport = {
  class: { id: string; name: string };
  month: string;
  timeZone: "Asia/Ho_Chi_Minh";
  period: { from: string; toExclusive: string };
  sessions: { completed: number; scheduled: number; cancelled: number };
  totals: {
    students: number;
    eligibleSessions: number;
    present: number;
    absent: number;
    unmarked: number;
    attendanceRate: number | null;
  };
  students: MonthlyAttendanceRow[];
};

export type MonthlyTuitionReport = Omit<
  MonthlyAttendanceReport,
  "totals" | "students"
> & {
  pricing: {
    currency: "VND";
    billableStatus: "PRESENT";
    absenceBillable: false;
    effectiveMonth: string | null;
    amountPerSessionVnd: number | null;
    ready: boolean;
    warning: string | null;
  };
  totals: MonthlyAttendanceReport["totals"] & {
    billableSessions: number;
    amountVnd: number | null;
  };
  students: Array<
    MonthlyAttendanceRow & {
      billableSessions: number;
      amountVnd: number | null;
    }
  >;
};

export function getMonthlyAttendance(
  token: string,
  classId: string,
  month: string,
) {
  return apiClient<MonthlyAttendanceReport>(
    `/classes/${encodeURIComponent(classId)}/attendance/monthly?month=${encodeURIComponent(month)}`,
    { token },
  );
}

export function getMonthlyTuition(
  token: string,
  classId: string,
  month: string,
) {
  return apiClient<MonthlyTuitionReport>(
    `/classes/${encodeURIComponent(classId)}/tuition/monthly?month=${encodeURIComponent(month)}`,
    { token },
  );
}

export function setClassTuitionRate(
  token: string,
  classId: string,
  month: string,
  amountVnd: number,
) {
  return apiClient<{
    classId: string;
    currency: "VND";
    effectiveMonth: string;
    amountVnd: number;
  }>(
    `/classes/${encodeURIComponent(classId)}/tuition/rates/${encodeURIComponent(month)}`,
    { method: "PUT", token, body: JSON.stringify({ amountVnd }) },
  );
}
