import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMonthlyAttendanceReport,
  monthBounds,
  type EnrollmentForReport,
  type SessionForReport,
} from "../services/monthly-attendance.js";

const date = (value: string) => new Date(value);
const november = "2026-11";

const sessions: SessionForReport[] = [
  {
    id: "before",
    status: "COMPLETED",
    startsAt: date("2026-10-31T16:59:59.999Z"),
  },
  { id: "s1", status: "COMPLETED", startsAt: date("2026-10-31T17:00:00.000Z") },
  { id: "cancel", status: "CANCELLED", startsAt: date("2026-11-01T02:00:00Z") },
  {
    id: "planned",
    status: "SCHEDULED",
    startsAt: date("2026-11-02T02:00:00Z"),
  },
  { id: "s2", status: "COMPLETED", startsAt: date("2026-11-02T03:00:00Z") },
  { id: "s3", status: "COMPLETED", startsAt: date("2026-11-03T03:00:00Z") },
  { id: "after", status: "COMPLETED", startsAt: date("2026-11-30T17:00:00Z") },
];

function student(
  id: string,
  periods: EnrollmentForReport["periods"],
  statuses: Array<[string, "PRESENT" | "ABSENT"]>,
  status: "ACTIVE" | "DROPPED" = "ACTIVE",
): EnrollmentForReport {
  return {
    id,
    status,
    student: {
      id: `student-${id}`,
      studentCode: `ST-${id}`,
      fullName: `Student ${id}`,
    },
    periods,
    attendance: statuses.map(([sessionId, attendanceStatus]) => ({
      sessionId,
      status: attendanceStatus,
    })),
  };
}

test("Vietnam-local month bounds are inclusive at start and exclusive at end", () => {
  assert.deepEqual(
    Object.values(monthBounds("2026-11")).map((value) => value.toISOString()),
    ["2026-10-31T17:00:00.000Z", "2026-11-30T17:00:00.000Z"],
  );
  assert.equal(
    monthBounds("2026-12").toExclusive.toISOString(),
    "2026-12-31T17:00:00.000Z",
  );
  for (const bad of ["2026-00", "2026-13", "2026-1", "2026/11", "0001-11"]) {
    assert.throws(() => monthBounds(bad));
  }
});

test("only completed sessions count and periods determine eligibility, not current status", () => {
  const report = buildMonthlyAttendanceReport({
    month: november,
    sessions,
    enrollments: [
      student(
        "a",
        [{ startedAt: date("2026-10-01T00:00:00Z"), endedAt: null }],
        [
          ["s1", "PRESENT"],
          ["s2", "ABSENT"],
          ["s3", "PRESENT"],
          ["cancel", "ABSENT"],
        ],
      ),
      student(
        "b",
        [
          {
            startedAt: date("2026-10-01T00:00:00Z"),
            endedAt: date("2026-11-02T03:00:00Z"),
          },
          { startedAt: date("2026-11-03T03:00:00Z"), endedAt: null },
        ],
        [
          ["s1", "ABSENT"],
          ["s2", "PRESENT"],
          ["s3", "PRESENT"],
        ],
        "DROPPED",
      ),
      student(
        "c",
        [{ startedAt: date("2026-11-10T00:00:00Z"), endedAt: null }],
        [],
      ),
    ],
  });
  assert.deepEqual(report.sessions, {
    scheduled: 1,
    completed: 3,
    cancelled: 1,
  });
  assert.deepEqual(report.totals, {
    students: 3,
    eligibleSessions: 5,
    present: 3,
    absent: 2,
    unmarked: 0,
    attendanceRate: 60,
  });
  assert.deepEqual(
    report.students.map((row) => ({
      code: row.studentCode,
      eligible: row.eligibleSessions,
      present: row.present,
      absent: row.absent,
      rate: row.attendanceRate,
    })),
    [
      { code: "ST-a", eligible: 3, present: 2, absent: 1, rate: 66.7 },
      { code: "ST-b", eligible: 2, present: 1, absent: 1, rate: 50 },
      { code: "ST-c", eligible: 0, present: 0, absent: 0, rate: null },
    ],
  );
  assert.equal(report.students[1].enrollmentStatus, "DROPPED");
});

test("missing record in a completed eligible session remains Unmarked, not Absent", () => {
  const report = buildMonthlyAttendanceReport({
    month: november,
    sessions: [sessions[1]],
    enrollments: [
      student(
        "a",
        [{ startedAt: date("2026-10-01T00:00:00Z"), endedAt: null }],
        [],
      ),
    ],
  });
  assert.deepEqual(report.totals, {
    students: 1,
    eligibleSessions: 1,
    present: 0,
    absent: 0,
    unmarked: 1,
    attendanceRate: 0,
  });
});

test("empty month and no eligible completed sessions have null rates", () => {
  const period = [{ startedAt: date("2026-10-01T00:00:00Z"), endedAt: null }];
  const report = buildMonthlyAttendanceReport({
    month: november,
    sessions: [],
    enrollments: [student("a", period, [])],
  });
  assert.equal(report.sessions.completed, 0);
  assert.equal(report.students[0].attendanceRate, null);
  assert.equal(report.totals.attendanceRate, null);
});
