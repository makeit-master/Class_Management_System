import assert from "node:assert/strict";
import test from "node:test";
import { buildMonthlyTuitionReport } from "../services/monthly-tuition.js";
import type { MonthlyAttendanceReport } from "../services/monthly-attendance.js";

const base: MonthlyAttendanceReport = {
  month: "2026-11", timeZone: "Asia/Ho_Chi_Minh",
  period: { from: "2026-10-31T17:00:00.000Z", toExclusive: "2026-11-30T17:00:00.000Z" },
  sessions: { completed: 3, scheduled: 1, cancelled: 2 },
  totals: { students: 2, eligibleSessions: 5, present: 3, absent: 2, unmarked: 0, attendanceRate: 60 },
  students: [
    { enrollmentId: "e1", studentId: "s1", studentCode: "S1", fullName: "A", enrollmentStatus: "ACTIVE", eligibleSessions: 3, present: 2, absent: 1, unmarked: 0, attendanceRate: 66.7 },
    { enrollmentId: "e2", studentId: "s2", studentCode: "S2", fullName: "B", enrollmentStatus: "DROPPED", eligibleSessions: 2, present: 1, absent: 1, unmarked: 0, attendanceRate: 50 },
  ],
};

test("charges PRESENT only, not ABSENT, with historical enrollment supported", () => {
  const r = buildMonthlyTuitionReport(base, { amountVnd: 125_000, effectiveMonth: "2026-10" });
  assert.equal(r.pricing.ready, true);
  assert.equal(r.pricing.absenceBillable, false);
  assert.equal(r.pricing.effectiveMonth, "2026-10");
  assert.equal(r.totals.billableSessions, 3);
  assert.equal(r.totals.amountVnd, 375_000);
  assert.deepEqual(r.students.map(x => x.amountVnd), [250_000, 125_000]);
});

test("no configured rate returns null amounts, not misleading zero", () => {
  const r = buildMonthlyTuitionReport(base, null);
  assert.equal(r.pricing.ready, false);
  assert.equal(r.totals.amountVnd, null);
  assert.equal(r.students[0].amountVnd, null);
});

test("an explicit zero VND rate is allowed and distinct from no rate", () => {
  const r = buildMonthlyTuitionReport(base, { amountVnd: 0, effectiveMonth: "2026-11" });
  assert.equal(r.pricing.ready, true);
  assert.equal(r.totals.amountVnd, 0);
});

test("unmarked records do not add charges or suppress PRESENT estimates", () => {
  const r = buildMonthlyTuitionReport({ ...base, totals: { ...base.totals, unmarked: 1 } }, { amountVnd: 100000, effectiveMonth: "2026-11" });
  assert.equal(r.pricing.ready, true);
  assert.equal(r.totals.amountVnd, 300000);
  assert.deepEqual(r.students.map(x => x.amountVnd), [200000, 100000]);
  assert.ok(r.pricing.warning?.includes("unmarked"));
});

test("invalid rates rejected by pure calculator", () => {
  for (const amountVnd of [-1, 2.4, Number.POSITIVE_INFINITY, 100_000_001]) {
    assert.throws(() => buildMonthlyTuitionReport(base, { amountVnd, effectiveMonth: "2026-11" }));
  }
});
