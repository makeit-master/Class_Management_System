import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { hash } from "bcryptjs";

// Explicit opt-in and a local database are required before importing the app.
// This test creates its own fixtures; it never resets or deletes existing data.
const url = new URL(process.env.DATABASE_URL || "postgresql://invalid");
if (
  process.env.E2E_DB_ISOLATED !== "YES" ||
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  !url.pathname.endsWith("_test")
) {
  throw new Error(
    "Use E2E_DB_ISOLATED=YES and a local database ending in _test.",
  );
}
const { app } = await import("../../apps/api/src/app.js");
const { getPrisma, disconnectPrisma } =
  await import("../../apps/api/src/lib/prisma.js");
const { issueAccessToken } = await import("../../apps/api/src/auth/token.js");

test("monthly reports against isolated PostgreSQL", async (t) => {
  const prisma = getPrisma();
  const suffix = randomUUID();
  const password = "M19-local-validation-only!";
  const passwordHash = await hash(password, 4);
  const admin = await prisma.user.create({
    data: {
      fullName: "M19 Test Admin",
      email: `admin-${suffix}@example.test`,
      role: "ADMIN",
      passwordHash,
    },
  });
  const teacher = await prisma.teacher.create({
    data: {
      user: {
        create: {
          fullName: "M19 Test Teacher",
          email: `teacher-${suffix}@example.test`,
          role: "TEACHER",
          passwordHash,
        },
      },
    },
  });
  const otherTeacher = await prisma.teacher.create({
    data: {
      user: {
        create: {
          fullName: "M19 Other Teacher",
          email: `other-${suffix}@example.test`,
          role: "TEACHER",
          passwordHash,
        },
      },
    },
  });
  const target = await prisma.class.create({
    data: { name: `M19 Test ${suffix}`, teacherId: teacher.id },
  });
  const archived = await prisma.class.create({
    data: { name: "Archived", teacherId: teacher.id, archivedAt: new Date() },
  });
  const student = await prisma.student.create({
    data: { studentCode: `M19-${suffix}`, fullName: "M19 Test Student" },
  });
  const enrollment = await prisma.enrollment.create({
    data: {
      classId: target.id,
      studentId: student.id,
      periods: { create: { startedAt: new Date("2026-01-01T00:00:00Z") } },
    },
  });
  const fixtures = [
    ["2026-10-31T17:00:00Z", "COMPLETED", "PRESENT"],
    ["2026-11-02T03:00:00Z", "COMPLETED", "ABSENT"],
    ["2026-11-03T03:00:00Z", "COMPLETED", null],
    ["2026-11-04T03:00:00Z", "SCHEDULED", "PRESENT"],
    ["2026-11-05T03:00:00Z", "CANCELLED", "PRESENT"],
    ["2026-10-31T16:59:59Z", "COMPLETED", "PRESENT"],
    ["2026-11-30T17:00:00Z", "COMPLETED", "PRESENT"],
  ] as const;
  for (const [startsAt, status, attendance] of fixtures) {
    await prisma.classSession.create({
      data: {
        classId: target.id,
        startsAt: new Date(startsAt),
        endsAt: new Date(Date.parse(startsAt) + 3600000),
        status,
        ...(attendance
          ? {
              attendance: {
                create: { enrollmentId: enrollment.id, status: attendance },
              },
            }
          : {}),
      },
    });
  }
  const tokens = {
    admin: await issueAccessToken(admin.id, "ADMIN"),
    teacher: await issueAccessToken(teacher.userId, "TEACHER"),
    other: await issueAccessToken(otherTeacher.userId, "TEACHER"),
  };
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  async function request(
    path: string,
    role: keyof typeof tokens | null = "admin",
    amount?: unknown,
  ) {
    const response = await fetch(`${baseUrl}/api/classes/${path}`, {
      method: amount === undefined ? "GET" : "PUT",
      headers: {
        ...(role ? { Authorization: `Bearer ${tokens[role]}` } : {}),
        "Content-Type": "application/json",
      },
      ...(amount === undefined
        ? {}
        : { body: JSON.stringify({ amountVnd: amount }) }),
    });
    return { status: response.status, body: await response.json() };
  }
  const rate = (month: string) => `${target.id}/tuition/rate?month=${month}`;
  const monthly = `${target.id}/tuition/monthly?month=2026-11`;
  try {
    await t.test("all monthly endpoints require authentication", async () => {
      for (const path of [
        rate("2026-11"),
        monthly,
        `${target.id}/attendance/monthly?month=2026-11`,
      ]) {
        assert.equal((await request(path, null)).status, 401);
      }
      assert.equal(
        (await request(`${target.id}/tuition/rates/2026-11`, null, 1)).status,
        401,
      );
    });
    await t.test("missing price is distinct from zero", async () => {
      const { status, body } = await request(monthly);
      assert.equal(status, 200);
      assert.equal(body.data.totals.amountVnd, null);
      assert.equal(body.data.pricing.ready, false);
    });
    await t.test(
      "assigned teachers read; other teachers and teacher writes are denied",
      async () => {
        assert.equal((await request(monthly, "teacher")).status, 200);
        for (const path of [
          rate("2026-11"),
          monthly,
          `${target.id}/attendance/monthly?month=2026-11`,
        ]) {
          assert.equal((await request(path, "other")).status, 403);
        }
        assert.equal(
          (await request(`${target.id}/tuition/rates/2026-11`, "teacher", 100))
            .status,
          403,
        );
      },
    );
    await t.test("invalid IDs, months and amounts return 400", async () => {
      for (const path of [
        "invalid/tuition/rate?month=2026-11",
        rate("2026-13"),
        rate("0000-01"),
        rate("9999-01"),
      ]) {
        assert.equal((await request(path)).status, 400);
      }
      for (const amount of [-1, 1.5, 100000001, "100", null]) {
        assert.equal(
          (await request(`${target.id}/tuition/rates/2026-11`, "admin", amount))
            .status,
          400,
        );
      }
    });
    await t.test("archived and missing classes return 404", async () => {
      for (const id of [archived.id, randomUUID()]) {
        assert.equal(
          (await request(`${id}/tuition/monthly?month=2026-11`)).status,
          404,
        );
        assert.equal(
          (await request(`${id}/tuition/rates/2026-11`, "admin", 100)).status,
          404,
        );
      }
    });
    await t.test(
      "effective months inherit only the latest earlier rate and preserve old prices",
      async () => {
        assert.equal(
          (await request(`${target.id}/tuition/rates/2026-10`, "admin", 125000))
            .status,
          200,
        );
        assert.equal(
          (await request(`${target.id}/tuition/rates/2026-12`, "admin", 150000))
            .status,
          200,
        );
        assert.equal(
          (await request(rate("2026-09"))).body.data.amountVnd,
          null,
        );
        assert.equal(
          (await request(rate("2026-11"))).body.data.amountVnd,
          125000,
        );
        assert.equal(
          (await request(rate("2026-12"))).body.data.amountVnd,
          150000,
        );
        assert.equal(
          (await request(rate("2027-01"))).body.data.effectiveMonth,
          "2026-12",
        );
        assert.equal(
          await prisma.classTuitionRate.count({
            where: { classId: target.id },
          }),
          2,
        );
      },
    );
    await t.test(
      "only completed eligible PRESENT records are billed, with Unmarked separate",
      async () => {
        const { body } = await request(monthly);
        assert.deepEqual(body.data.sessions, {
          scheduled: 1,
          completed: 3,
          cancelled: 1,
        });
        assert.equal(body.data.totals.present, 1);
        assert.equal(body.data.totals.absent, 1);
        assert.equal(body.data.totals.unmarked, 1);
        assert.equal(body.data.totals.billableSessions, 1);
        assert.equal(body.data.totals.amountVnd, 125000);
        assert.equal(body.data.students[0].amountVnd, 125000);
      },
    );
    await t.test(
      "historically dropped students remain in reports",
      async () => {
        await prisma.enrollment.update({
          where: { id: enrollment.id },
          data: { status: "DROPPED" },
        });
        const { body } = await request(monthly);
        assert.equal(body.data.students[0].enrollmentStatus, "DROPPED");
        assert.equal(body.data.totals.amountVnd, 125000);
        await prisma.enrollment.update({
          where: { id: enrollment.id },
          data: { status: "ACTIVE" },
        });
      },
    );
    await t.test(
      "zero rate produces zero while keeping prior month prices",
      async () => {
        assert.equal(
          (await request(`${target.id}/tuition/rates/2026-11`, "admin", 0))
            .status,
          200,
        );
        assert.equal((await request(monthly)).body.data.totals.amountVnd, 0);
        assert.equal(
          (await request(rate("2026-10"))).body.data.amountVnd,
          125000,
        );
        assert.equal(
          (await request(rate("2026-12"))).body.data.amountVnd,
          150000,
        );
      },
    );
    await t.test(
      "migration enforces amount and effective-month constraints",
      async () => {
        await assert.rejects(
          prisma.classTuitionRate.create({
            data: {
              classId: target.id,
              effectiveMonth: "2026-13",
              amountVnd: 100,
            },
          }),
        );
        await assert.rejects(
          prisma.classTuitionRate.create({
            data: {
              classId: target.id,
              effectiveMonth: "2027-01",
              amountVnd: -1,
            },
          }),
        );
      },
    );
    // Retain the generated fixtures for the existing enrollment browser test.
    console.log(
      JSON.stringify({
        e2eFixture: {
          email: admin.email,
          className: target.name,
          studentCode: student.studentCode,
        },
      }),
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await disconnectPrisma();
  }
});
