import assert from "node:assert/strict";
import { test } from "node:test";
import {
  profileSchema,
  registrationSchema,
} from "../auth/registration-validation.js";
process.env.AUTH_JWT_SECRET = "registration-isolated-test-secret-32-bytes";
process.env.DATABASE_URL = "postgresql://unused:unused@127.0.0.1:1/unused";
const profile = {
  fullName: " Test Person ",
  dateOfBirth: "2000-02-29",
  gender: "PREFER_NOT_TO_SAY",
  phone: "0912345678",
  acceptTerms: true,
};
const input = {
  ...profile,
  email: " USER@example.com ",
  password: "Password-long-123",
  confirmPassword: "Password-long-123",
};
test("complete registration normalizes profile and rejects missing or invalid required fields", () => {
  const data = registrationSchema.parse(input);
  assert.equal(data.phone, "+84912345678");
  assert.equal(data.email, "user@example.com");
  assert.equal(data.fullName, "Test Person");
  assert.equal(
    profileSchema.parse({ ...profile, phone: "+84 912 345 678" }).phone,
    data.phone,
  );
  for (const field of Object.keys(input)) {
    const missing = { ...input } as Record<string, unknown>;
    delete missing[field];
    assert.equal(registrationSchema.safeParse(missing).success, false, field);
  }
  for (const patch of [
    { email: "bad" },
    { dateOfBirth: "2000-02-30" },
    { dateOfBirth: "2999-01-01" },
    { gender: "ADMIN" },
    { phone: "123" },
    { confirmPassword: "mismatch" },
    { password: "short" },
    { address: "x".repeat(501) },
    { role: "ADMIN" },
    { acceptTerms: false },
  ])
    assert.equal(
      registrationSchema.safeParse({ ...input, ...patch }).success,
      false,
      JSON.stringify(patch),
    );
  assert.equal(
    profileSchema.safeParse({ ...profile, dateOfBirth: "2010-01-01" }).success,
    true,
    "No blanket adult-only rule",
  );
  assert.equal(
    profileSchema.safeParse(profile).success,
    true,
    "Google profiles need no password",
  );
});
test("registration sessions cannot be used as application access tokens", async () => {
  const { registrationSession, registrationSubject } =
    await import("../auth/registration-session.js");
  const { verifyAccessToken } = await import("../auth/token.js");
  const token = await registrationSession("test-id");
  assert.equal(await registrationSubject("Bearer " + token), "test-id");
  await assert.rejects(verifyAccessToken(token));
});
test("pending and rejected users cannot access protected routes, ordinary users cannot review", async () => {
  const { requireAuth, requireRole } =
    await import("../middleware/require-auth.js");
  const { issueAccessToken } = await import("../auth/token.js");
  const { getPrisma } = await import("../lib/prisma.js");
  const db = getPrisma();
  const original = db.user.findUnique;
  try {
    const token = await issueAccessToken("pending", "TEACHER");
    for (const status of ["PENDING", "REJECTED"]) {
      db.user.findUnique = (async () => ({
        id: "pending",
        role: "TEACHER",
        isActive: true,
        registrationStatus: status,
      })) as unknown as typeof original;
      const req = { header: () => "Bearer " + token };
      let error: unknown;
      await requireAuth(req as never, {} as never, (e) => {
        error = e;
      });
      assert.ok(error);
    }
    let forbidden: unknown;
    requireRole("ADMIN")(
      { authUser: { role: "TEACHER" } } as never,
      {} as never,
      (e) => {
        forbidden = e;
      },
    );
    assert.ok(forbidden);
  } finally {
    db.user.findUnique = original;
  }
});

test("registration HTTP stores complete profile, hides duplicates and guards approval transitions", async () => {
  const { app } = await import("../app.js");
  const { getPrisma } = await import("../lib/prisma.js");
  const { issueAccessToken } = await import("../auth/token.js");
  const { registrationSession } =
    await import("../auth/registration-session.js");
  const db = getPrisma();
  const restores: Array<() => void> = [];
  const stub = (target: object, key: string, value: unknown) => {
    const obj = target as Record<string, unknown>;
    const old = obj[key];
    obj[key] = value;
    restores.push(() => {
      obj[key] = old;
    });
  };
  let created: Record<string, unknown> | undefined;
  let duplicate = false;
  let complete = true;
  let recorded = false;
  stub(db.user, "findFirst", async () =>
    duplicate ? { id: "existing" } : null,
  );
  stub(db.user, "create", async (args: { data: Record<string, unknown> }) => {
    created = args.data;
    return { id: "new", ...args.data };
  });
  stub(db.user, "findUnique", async () => ({
    id: "admin",
    fullName: "Admin",
    email: "admin@example.com",
    role: "ADMIN",
    isActive: true,
    registrationStatus: "APPROVED",
  }));
  stub(db, "$transaction", async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      user: {
        updateMany: async (args: { where: Record<string, unknown> }) => {
          assert.equal(args.where.registrationStatus, "PENDING");
          assert.ok(args.where.profileCompletedAt);
          return { count: complete ? 1 : 0 };
        },
      },
      teacher: { upsert: async () => ({}) },
      registrationReview: {
        create: async () => {
          recorded = true;
        },
      },
    }),
  );
  process.env.REGISTRATION_EMAIL_WEBHOOK = "https://mail.invalid/send";
  process.env.REGISTRATION_PUBLIC_URL = "https://classflow.invalid";
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((url: unknown, options: unknown) =>
    String(url).startsWith("https://mail.invalid")
      ? Promise.resolve(new Response("", { status: 200 }))
      : realFetch(url as string, options as RequestInit)) as typeof fetch;
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw Error();
  const send = (path: string, body: unknown, token?: string) =>
    fetch(`http://127.0.0.1:${address.port}/api/auth${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    const response = await send("/register", input);
    assert.equal(response.status, 202);
    const first = await response.json();
    assert.ok(created);
    assert.equal(created.phone, "+84912345678");
    assert.equal(created.registrationStatus, "PENDING");
    assert.equal(created.isActive, false);
    assert.ok(created.dateOfBirth instanceof Date);
    assert.equal(created.confirmPassword, undefined);
    assert.equal(created.password, undefined);
    assert.notEqual(created.passwordHash, input.password);
    const { compare } = await import("bcryptjs");
    assert.equal(
      await compare(input.password, String(created.passwordHash)),
      true,
    );
    duplicate = true;
    const again = await send("/register", input);
    assert.equal(again.status, 202);
    assert.deepEqual(await again.json(), first);
    const session = await registrationSession("google-user");
    const denied = await send(
      "/registrations/new/review",
      { decision: "APPROVED", role: "TEACHER" },
      session,
    );
    assert.equal(denied.status, 401);
    const admin = await issueAccessToken("admin", "ADMIN");
    assert.equal(
      (
        await send(
          "/registrations/new/review",
          { decision: "APPROVED", role: "ADMIN" },
          admin,
        )
      ).status,
      400,
    );
    complete = false;
    assert.equal(
      (
        await send(
          "/registrations/new/review",
          { decision: "APPROVED", role: "TEACHER" },
          admin,
        )
      ).status,
      409,
    );
    assert.equal(recorded, false);
    complete = true;
    assert.equal(
      (
        await send(
          "/registrations/new/review",
          { decision: "APPROVED", role: "TEACHER" },
          admin,
        )
      ).status,
      200,
    );
    assert.equal(recorded, true);
  } finally {
    globalThis.fetch = realFetch;
    for (const restore of restores.reverse()) restore();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
