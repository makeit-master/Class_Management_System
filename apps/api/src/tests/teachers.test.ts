import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { hash, compare } from "bcryptjs";
process.env.AUTH_JWT_SECRET = "isolated-teacher-test-secret-32-bytes-long";
process.env.DATABASE_URL = "postgresql://unused:unused@127.0.0.1:1/unused";
const { app } = await import("../app.js");
const { getPrisma } = await import("../lib/prisma.js");
const { issueAccessToken } = await import("../auth/token.js");
const { createTeacherSchema } = await import("../routes/teacher.routes.js");

test("teacher validation normalizes email and rejects unsafe provisioning", () => {
  const input = {
    fullName: " Teacher ",
    email: " PERSON@example.com ",
    password: "Secure-test-1234",
  };
  assert.equal(createTeacherSchema.parse(input).email, "person@example.com");
  for (const extra of [
    { password: "short" },
    { role: "ADMIN" },
    { email: "invalid" },
    { password: "界".repeat(30) },
  ])
    assert.equal(
      createTeacherSchema.safeParse({ ...input, ...extra }).success,
      false,
    );
});

test("ADMIN teacher management and account lifecycle HTTP integration (isolated Prisma stubs)", async () => {
  const db = getPrisma();
  const restores: (() => void)[] = [];
  const mock = {
    method(target: object, key: string, fn: unknown) {
      const obj = target as Record<string, unknown>;
      const previous = obj[key];
      obj[key] = fn;
      restores.push(() => {
        obj[key] = previous;
      });
    },
    restoreAll() {
      for (const restore of restores.reverse()) restore();
    },
  };
  const tid = "00000000-0000-4000-8000-000000000020";
  const teacherUser = {
    id: "teacher-user",
    fullName: "Teacher",
    email: "teacher@test.com",
    role: "TEACHER",
    isActive: true,
    passwordHash: await hash("Secure-test-1234", 4),
    teacherProfile: { id: tid },
  };
  const admin = {
    ...teacherUser,
    id: "admin",
    role: "ADMIN",
    teacherProfile: null,
  };
  let record = {
    id: tid,
    employeeCode: "EMP20",
    subject: "Math",
    user: teacherUser,
    classes: [],
  };
  let assigned = false;
  let duplicate = false;
  // Every database operation used by these requests is replaced; no database connection is opened.
  mock.method(
    db.user,
    "findUnique",
    async ({ where }: { where: { id?: string; email?: string } }) =>
      where.id === "admin" ? admin : teacherUser,
  );
  mock.method(
    db.user,
    "update",
    async ({ data }: { data: { isActive: boolean } }) => {
      teacherUser.isActive = data.isActive;
      return teacherUser;
    },
  );
  mock.method(db.teacher, "findMany", async () => [record]);
  mock.method(db.teacher, "count", async () => 1);
  mock.method(db.teacher, "findUnique", async () => ({
    ...record,
    userId: teacherUser.id,
  }));
  mock.method(db.teacher, "findUniqueOrThrow", async () => record);
  mock.method(
    db.teacher,
    "create",
    async ({
      data,
    }: {
      data: { user: { create: { passwordHash: string; email: string } } };
    }) => {
      if (duplicate) throw { code: "P2002" };
      assert.equal(
        await compare("Secure-test-1234", data.user.create.passwordHash),
        true,
      );
      assert.equal(data.user.create.email, "new@test.com");
      return {
        ...record,
        user: { fullName: "New", email: "new@test.com", isActive: true },
      };
    },
  );
  mock.method(db.teacher, "update", async () => {
    record = { ...record, subject: "Physics" };
    return record;
  });
  mock.method(db.class, "count", async () => (assigned ? 1 : 0));
  mock.method(db, "$queryRaw", async () => []);
  mock.method(db, "$transaction", async (fn: (tx: typeof db) => unknown) =>
    fn(db),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api`;
  const adminToken = await issueAccessToken("admin", "ADMIN");
  const teacherToken = await issueAccessToken(teacherUser.id, "TEACHER");
  const request = (
    path: string,
    method = "GET",
    body?: unknown,
    token = adminToken,
  ) =>
    fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    assert.equal((await request("/teachers")).status, 200);
    assert.equal(
      (await request("/teachers", "GET", undefined, teacherToken)).status,
      403,
    );
    for (const [path, method] of [
      [`/teachers/${tid}`, "GET"],
      ["/teachers", "POST"],
      [`/teachers/${tid}`, "PATCH"],
      [`/teachers/${tid}/deactivate`, "PATCH"],
      [`/teachers/${tid}/reactivate`, "PATCH"],
    ]) {
      assert.equal(
        (await request(path, method, undefined, teacherToken)).status,
        403,
      );
    }
    const input = {
      fullName: "New",
      email: " NEW@test.com ",
      employeeCode: "EMP20",
      password: "Secure-test-1234",
    };
    const created = await request("/teachers", "POST", input);
    assert.equal(created.status, 201);
    assert.ok(!JSON.stringify(await created.json()).includes("passwordHash"));
    assert.equal(
      (await request(`/teachers/${tid}`, "PATCH", { subject: "Physics" }))
        .status,
      200,
    );
    assert.equal(record.subject, "Physics");
    duplicate = true;
    assert.equal(
      (
        await request("/teachers", "POST", {
          ...input,
          employeeCode: "different",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request("/teachers", "POST", {
          ...input,
          email: "different@test.com",
        })
      ).status,
      409,
    );
    assigned = true;
    assert.equal(
      (await request(`/teachers/${tid}/deactivate`, "PATCH")).status,
      409,
    );
    assert.equal(teacherUser.isActive, true);
    assigned = false;
    assert.equal(
      (await request(`/teachers/${tid}/deactivate`, "PATCH")).status,
      200,
    );
    assert.equal(
      (await request("/auth/me", "GET", undefined, teacherToken)).status,
      401,
    );
    const login = () =>
      request("/auth/login", "POST", {
        email: teacherUser.email,
        password: "Secure-test-1234",
      });
    assert.equal((await login()).status, 401);
    assert.equal(
      (await request(`/teachers/${tid}/reactivate`, "PATCH")).status,
      200,
    );
    assert.equal((await login()).status, 200);
    assert.equal(record.id, tid);
  } finally {
    server.close();
    mock.restoreAll();
  }
});
