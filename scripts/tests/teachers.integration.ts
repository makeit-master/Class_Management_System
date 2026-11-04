import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import test from "node:test";
const url = new URL(process.env.DATABASE_URL || "postgresql://invalid");
if (
  process.env.E2E_DB_ISOLATED !== "YES" ||
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  !url.pathname.endsWith("_test")
)
  throw new Error(
    "Use E2E_DB_ISOLATED=YES and a local database ending in _test; apply migrations first.",
  );
const { app } = await import("../../apps/api/src/app.js");
const { getPrisma, disconnectPrisma } =
  await import("../../apps/api/src/lib/prisma.js");
const { issueAccessToken } = await import("../../apps/api/src/auth/token.js");
test("Teacher persistence, assignment guards and lifecycle against isolated PostgreSQL", async () => {
  const db = getPrisma();
  const suffix = randomUUID();
  const admin = await db.user.create({
    data: {
      fullName: "M20 test",
      email: `admin-${suffix}@example.test`,
      role: "ADMIN",
    },
  });
  const token = await issueAccessToken(admin.id, "ADMIN");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  assert.ok(addr && typeof addr !== "string");
  const call = (path: string, method = "GET", body?: unknown, auth = token) =>
    fetch(`http://127.0.0.1:${addr.port}/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${auth}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    const input = {
      fullName: "M20 persisted teacher",
      email: `teacher-${suffix}@example.test`,
      employeeCode: suffix,
      password: "M20-isolated-test-only!",
    };
    const created = await call("/teachers", "POST", input);
    assert.equal(created.status, 201);
    const teacher = (await created.json()).data;
    assert.equal(
      (
        await call("/teachers", "POST", {
          ...input,
          employeeCode: `new-${suffix}`,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call("/teachers", "POST", {
          ...input,
          email: `other-${suffix}@example.test`,
        })
      ).status,
      409,
    );
    assert.equal(
      (await call(`/teachers/${teacher.id}`, "PATCH", { subject: "Physics" }))
        .status,
      200,
    );
    assert.equal(
      (await db.teacher.findUniqueOrThrow({ where: { id: teacher.id } }))
        .subject,
      "Physics",
    );
    const login = () =>
      call("/auth/login", "POST", {
        email: input.email,
        password: input.password,
      });
    const access = (await (await login()).json()).data.accessToken;
    const klass = await db.class.create({
      data: { name: `M20 ${suffix}`, teacherId: teacher.id },
    });
    assert.equal(
      (await call(`/teachers/${teacher.id}/deactivate`, "PATCH")).status,
      409,
    );
    await db.class.update({
      where: { id: klass.id },
      data: { archivedAt: new Date() },
    });
    assert.equal(
      (await call(`/teachers/${teacher.id}/deactivate`, "PATCH")).status,
      200,
    );
    assert.equal((await login()).status, 401);
    assert.equal(
      (await call("/auth/me", "GET", undefined, access)).status,
      401,
    );
    assert.equal(
      (
        await call("/classes", "POST", {
          name: "Invalid assignment",
          teacherId: teacher.id,
        })
      ).status,
      404,
    );
    assert.equal(
      (await call(`/classes/${klass.id}/restore`, "PATCH")).status,
      409,
    );
    await assert.rejects(
      db.class.create({
        data: { name: "Direct inactive assignment", teacherId: teacher.id },
      }),
    );
    assert.equal(
      (await call(`/teachers/${teacher.id}/reactivate`, "PATCH")).status,
      200,
    );
    assert.equal((await login()).status, 200);
    assert.equal(
      (await call(`/classes/${klass.id}/restore`, "PATCH")).status,
      200,
    );
    assert.equal(
      (await db.class.findUniqueOrThrow({ where: { id: klass.id } })).teacherId,
      teacher.id,
    );
    // Fixtures are retained in the explicitly isolated test database for inspection.
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectPrisma();
  }
});
