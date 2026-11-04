import type { MonthlyAttendanceReport } from "./monthly-attendance.js";

/**
 * M19.4: Tuition is an estimate, not a payment receipt or a finalized invoice.
 * A PRESENT record is billable; ABSENT and Unmarked are never billed.
 * Unmarked entries have no attendance record and do not add a charge.
 */
export type EffectiveTuitionRate = {
  effectiveMonth: string;
  amountVnd: number;
} | null;

export type MonthlyTuitionReport = Omit<MonthlyAttendanceReport, "totals" | "students"> & {
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
  students: Array<MonthlyAttendanceReport["students"][number] & {
    billableSessions: number;
    amountVnd: number | null;
  }>;
};

export function buildMonthlyTuitionReport(
  attendance: MonthlyAttendanceReport,
  rate: EffectiveTuitionRate,
): MonthlyTuitionReport {
  if (rate && (!Number.isSafeInteger(rate.amountVnd) || rate.amountVnd < 0 || rate.amountVnd > 100_000_000)) {
    throw new Error("Invalid tuition rate amount.");
  }
  const warning = rate === null
    ? "No tuition rate is configured for this class and month."
    : attendance.totals.unmarked > 0
      ? "A completed session has unmarked attendance. Only saved Present records are included in this estimate."
      : null;
  const ready = rate !== null;
  const amountPerSessionVnd = rate?.amountVnd ?? null;
  return {
    ...attendance,
    pricing: {
      currency: "VND",
      billableStatus: "PRESENT",
      absenceBillable: false,
      effectiveMonth: rate?.effectiveMonth ?? null,
      amountPerSessionVnd,
      ready,
      warning,
    },
    totals: {
      ...attendance.totals,
      billableSessions: attendance.totals.present,
      amountVnd: ready && amountPerSessionVnd !== null
        ? attendance.totals.present * amountPerSessionVnd
        : null,
    },
    students: attendance.students.map((student) => ({
      ...student,
      billableSessions: student.present,
      amountVnd: ready && amountPerSessionVnd !== null
        ? student.present * amountPerSessionVnd
        : null,
    })),
  };
}
