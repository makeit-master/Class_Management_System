/**
 * M19.1 - Monthly attendance reporting rules.
 *
 * All dates are instants. The reporting period is expressed in Vietnam local
 * calendar months (UTC+07:00; Asia/Ho_Chi_Minh has no DST).
 * Only COMPLETED sessions count toward attendance statistics. An enrollment is
 * eligible at a session if one historical EnrollmentPeriod contains startsAt.
 *
 * This module deliberately does NOT define tuition/billing policy: whether an
 * absence is chargeable requires a separate business decision.
 */

export type AttendanceValue = "PRESENT" | "ABSENT";
export type SessionValue = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export type SessionForReport = {
  id: string;
  startsAt: Date;
  status: SessionValue;
};

export type EnrollmentForReport = {
  id: string;
  status: "ACTIVE" | "DROPPED";
  student: {
    id: string;
    studentCode: string;
    fullName: string;
  };
  periods: Array<{ startedAt: Date; endedAt: Date | null }>;
  attendance: Array<{ sessionId: string; status: AttendanceValue }>;
};

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
  /** Percentage of eligible, completed sessions attended; null if none. */
  attendanceRate: number | null;
};

export type MonthlyAttendanceReport = {
  month: string;
  timeZone: "Asia/Ho_Chi_Minh";
  period: { from: string; toExclusive: string };
  sessions: { scheduled: number; completed: number; cancelled: number };
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

/** Valid report months are YYYY-MM, years 1000–9998. */
export function monthBounds(month: string): { from: Date; toExclusive: Date } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("Month must use YYYY-MM with a valid month.");
  }
  const year = Number(month.slice(0, 4));
  const value = Number(month.slice(5, 7));
  // ISO date strings are more reliable than Date.UTC for years 0 through 99.
  if (year < 1000 || year > 9998) {
    throw new Error("Year must be between 1000 and 9998.");
  }
  const followingYear = value === 12 ? year + 1 : year;
  const followingMonth = value === 12 ? 1 : value + 1;
  const next = `${followingYear}-${String(followingMonth).padStart(2, "0")}`;
  return {
    from: new Date(`${month}-01T00:00:00+07:00`),
    toExclusive: new Date(`${next}-01T00:00:00+07:00`),
  };
}

function isEligible(
  periods: EnrollmentForReport["periods"],
  at: Date,
): boolean {
  const timestamp = at.getTime();
  return periods.some(
    (period) =>
      period.startedAt.getTime() <= timestamp &&
      (period.endedAt === null || timestamp < period.endedAt.getTime()),
  );
}

function rate(present: number, eligible: number): number | null {
  return eligible === 0 ? null : Math.round((present / eligible) * 1000) / 10;
}

export function buildMonthlyAttendanceReport(input: {
  month: string;
  sessions: SessionForReport[];
  enrollments: EnrollmentForReport[];
}): MonthlyAttendanceReport {
  const bounds = monthBounds(input.month);
  // Independently enforce status/period filtering. The service remains safe if
  // a caller accidentally passes sessions from another period.
  const monthSessions = input.sessions.filter(
    (session) =>
      session.startsAt >= bounds.from && session.startsAt < bounds.toExclusive,
  );
  const completed = monthSessions.filter(
    (session) => session.status === "COMPLETED",
  );

  const rows: MonthlyAttendanceRow[] = input.enrollments.map((enrollment) => {
    const savedStatuses = new Map(
      enrollment.attendance.map(
        (record) => [record.sessionId, record.status] as const,
      ),
    );
    let present = 0;
    let absent = 0;
    let unmarked = 0;
    let eligibleSessions = 0;

    for (const session of completed) {
      if (!isEligible(enrollment.periods, session.startsAt)) continue;
      eligibleSessions++;
      const status = savedStatuses.get(session.id);
      if (status === "PRESENT") present++;
      else if (status === "ABSENT") absent++;
      else unmarked++;
    }

    return {
      enrollmentId: enrollment.id,
      studentId: enrollment.student.id,
      studentCode: enrollment.student.studentCode,
      fullName: enrollment.student.fullName,
      enrollmentStatus: enrollment.status,
      eligibleSessions,
      present,
      absent,
      unmarked,
      attendanceRate: rate(present, eligibleSessions),
    };
  });

  rows.sort(
    (a, b) =>
      a.fullName.localeCompare(b.fullName, "vi") ||
      a.studentCode.localeCompare(b.studentCode),
  );
  const totals = rows.reduce(
    (sum, row) => ({
      eligibleSessions: sum.eligibleSessions + row.eligibleSessions,
      present: sum.present + row.present,
      absent: sum.absent + row.absent,
      unmarked: sum.unmarked + row.unmarked,
    }),
    { eligibleSessions: 0, present: 0, absent: 0, unmarked: 0 },
  );

  return {
    month: input.month,
    timeZone: "Asia/Ho_Chi_Minh",
    period: {
      from: bounds.from.toISOString(),
      toExclusive: bounds.toExclusive.toISOString(),
    },
    sessions: {
      scheduled: monthSessions.filter(
        (session) => session.status === "SCHEDULED",
      ).length,
      completed: completed.length,
      cancelled: monthSessions.filter(
        (session) => session.status === "CANCELLED",
      ).length,
    },
    totals: {
      students: rows.length,
      ...totals,
      attendanceRate: rate(totals.present, totals.eligibleSessions),
    },
    students: rows,
  };
}
