import { expect, test, type Page } from "@playwright/test";

type AttendanceStatus = "PRESENT" | "ABSENT";
type SessionStatus = "SCHEDULED" | "COMPLETED";
type AttendanceWrite = {
  records: { enrollmentId: string; status: AttendanceStatus }[];
};

const students = [
  {
    enrollmentId: "enr-1",
    studentId: "stu-1",
    studentCode: "ST-101",
    fullName: "Test Student One",
  },
  {
    enrollmentId: "enr-2",
    studentId: "stu-2",
    studentCode: "ST-102",
    fullName: "Test Student Two",
  },
  {
    enrollmentId: "enr-3",
    studentId: "stu-3",
    studentCode: "ST-103",
    fullName: "Test Student Three",
  },
] as const;

const startsAt = "2026-11-03T08:00:00.000Z";
const endsAt = "2026-11-03T09:00:00.000Z";

function list<T>(items: T[]) {
  return {
    items,
    pagination: { page: 1, limit: 20, total: items.length, totalPages: 1 },
  };
}

async function mockAttendanceApi(
  page: Page,
  options: { fullyMarked?: boolean; completionConflict?: boolean } = {},
) {
  let sessionStatus: SessionStatus = "SCHEDULED";
  let attendanceReads = 0;
  let completionRequests = 0;
  const attendanceWrites: AttendanceWrite[] = [];
  const saved: Record<string, AttendanceStatus | null> = {
    "enr-1": options.fullyMarked ? "PRESENT" : null,
    "enr-2": "PRESENT",
    "enr-3": options.fullyMarked ? "ABSENT" : null,
  };

  // Prevent any unexpected API call from reaching a running real backend.
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 501,
      json: { success: false, error: { code: "UNMOCKED_API_REQUEST" } },
    }),
  );

  // The app uses this token solely to pass its client-side auth gate.
  await page.addInitScript(() => {
    const payload = btoa(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    );
    sessionStorage.setItem("classflow_access_token", `test.${payload}.test`);
  });

  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          user: {
            id: "test-admin",
            fullName: "Test Admin",
            role: "ADMIN",
            email: "test@example.com",
          },
        },
      },
    }),
  );

  await page.route(/\/api\/classes\?/, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: list([
          {
            id: "class-a",
            name: "Test Mathematics",
            teacher: { user: { fullName: "Test Teacher" } },
          },
        ]),
      },
    }),
  );

  await page.route(/\/api\/classes\/class-a\/sessions\?/, (route) => {
    const selectedStatus = new URL(route.request().url()).searchParams.get(
      "status",
    );
    const entry = {
      id: "session-one",
      classId: "class-a",
      scheduleId: null,
      startsAt,
      endsAt,
      status: sessionStatus,
      attendanceCount: Object.values(saved).filter((value) => value !== null)
        .length,
    };
    return route.fulfill({
      json: {
        success: true,
        data: list(
          selectedStatus && selectedStatus !== sessionStatus ? [] : [entry],
        ),
      },
    });
  });

  await page.route("**/api/sessions/session-one/attendance", async (route) => {
    if (route.request().method() === "PUT") {
      const payload = route.request().postDataJSON() as AttendanceWrite;
      attendanceWrites.push(payload);
      for (const record of payload.records) {
        saved[record.enrollmentId] = record.status;
      }
      await route.fulfill({
        json: {
          success: true,
          data: {
            sessionId: "session-one",
            updatedCount: payload.records.length,
            markedAt: new Date().toISOString(),
            records: payload.records,
          },
        },
      });
      return;
    }

    if (route.request().method() !== "GET") {
      await route.fulfill({ status: 405 });
      return;
    }

    attendanceReads++;
    const present = Object.values(saved).filter(
      (value) => value === "PRESENT",
    ).length;
    const absent = Object.values(saved).filter(
      (value) => value === "ABSENT",
    ).length;
    await route.fulfill({
      json: {
        success: true,
        data: {
          session: {
            id: "session-one",
            classId: "class-a",
            className: "Test Mathematics",
            startsAt,
            endsAt,
            status: sessionStatus,
          },
          students: students.map((student) => ({
            ...student,
            attendanceStatus: saved[student.enrollmentId],
            note: null,
            markedAt: saved[student.enrollmentId] ? startsAt : null,
          })),
          summary: {
            present,
            absent,
            unmarked: students.length - present - absent,
          },
        },
      },
    });
  });

  await page.route("**/api/sessions/session-one/complete", async (route) => {
    completionRequests++;
    if (route.request().method() !== "PATCH") {
      await route.fulfill({ status: 405 });
      return;
    }

    if (options.completionConflict) {
      // Another editor completed the session before this request arrived.
      sessionStatus = "COMPLETED";
      await route.fulfill({
        status: 409,
        json: {
          success: false,
          error: {
            code: "SESSION_CONFLICT",
            message: "Session already completed",
          },
        },
      });
      return;
    }

    sessionStatus = "COMPLETED";
    await route.fulfill({
      json: {
        success: true,
        data: {
          sessionId: "session-one",
          classId: "class-a",
          status: "COMPLETED",
          summary: { present: 2, absent: 1, unmarked: 0 },
        },
      },
    });
  });

  return {
    attendanceWrites,
    getAttendanceReads: () => attendanceReads,
    getCompletionRequests: () => completionRequests,
    getSessionStatus: () => sessionStatus,
  };
}

async function openAttendance(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  await page.getByLabel("Class", { exact: true }).selectOption("class-a");
  await page
    .getByRole("button", { name: "Select session", exact: true })
    .click();
  const register = page.getByRole("region", {
    name: "Session attendance",
    exact: true,
  });
  await expect(
    register.getByRole("heading", { name: "Attendance register" }),
  ).toBeVisible();
  return register;
}

test("marks, saves, completes once, then stays read-only after reload", async ({
  page,
}) => {
  const api = await mockAttendanceApi(page);
  const register = await openAttendance(page);
  const complete = register.getByRole("button", {
    name: "Complete Session",
    exact: true,
  });
  const save = register.getByRole("button", {
    name: "Save attendance",
    exact: true,
  });

  await expect(complete).toBeDisabled(); // Two students are Unmarked.
  await expect(save).toBeDisabled();

  await register
    .getByLabel("Attendance for Test Student One (ST-101)")
    .selectOption("PRESENT");
  await register
    .getByLabel("Attendance for Test Student Three (ST-103)")
    .selectOption("ABSENT");
  await expect(register.getByText("2 unsaved changes")).toBeVisible();
  await expect(complete).toBeDisabled(); // A filled-in draft is NOT saved attendance.
  expect(api.attendanceWrites).toHaveLength(0);
  expect(api.getCompletionRequests()).toBe(0);

  await save.click();
  await expect(
    register.getByText("Attendance saved successfully."),
  ).toBeVisible();
  expect(api.attendanceWrites).toEqual([
    {
      records: [
        { enrollmentId: "enr-1", status: "PRESENT" },
        { enrollmentId: "enr-3", status: "ABSENT" },
      ],
    },
  ]);
  await expect(register.getByLabel("Attendance summary")).toContainText(
    "Present2Absent1Unmarked0",
  );
  await expect(complete).toBeEnabled();
  expect(api.getAttendanceReads()).toBeGreaterThanOrEqual(2);

  await complete.click();
  const confirmation = page.getByRole("dialog", { name: "Complete Session?" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  expect(api.getCompletionRequests()).toBe(0);

  await complete.click();
  await confirmation
    .getByRole("button", { name: "Confirm Completion" })
    .click();
  await expect(
    register.getByText("This session is completed. Attendance is read-only."),
  ).toBeVisible();
  await expect(complete).toHaveCount(0);
  await expect(
    register.getByRole("button", { name: "Save attendance" }),
  ).toHaveCount(0);
  await expect(
    register.getByLabel("Attendance for Test Student One (ST-101)"),
  ).toHaveCount(0);
  expect(api.getCompletionRequests()).toBe(1);
  expect(api.getSessionStatus()).toBe("COMPLETED");

  // Simulate a fresh browser render; the state is returned by the mocked API,
  // not retained by component state alone.
  await page.reload();
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  await page.getByLabel("Class", { exact: true }).selectOption("class-a");
  await expect(
    page.getByRole("cell", { name: "COMPLETED", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Select session", exact: true })
    .click();
  await expect(
    page.getByText("This session is completed. Attendance is read-only."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Complete Session" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save attendance" }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Attendance for Test Student One (ST-101)"),
  ).toHaveCount(0);
  expect(api.getCompletionRequests()).toBe(1);
  expect(api.attendanceWrites).toHaveLength(1);
});

test("a conflicting completion refreshes the register instead of retrying a write", async ({
  page,
}) => {
  const api = await mockAttendanceApi(page, {
    fullyMarked: true,
    completionConflict: true,
  });
  const register = await openAttendance(page);
  const complete = register.getByRole("button", {
    name: "Complete Session",
    exact: true,
  });

  await expect(complete).toBeEnabled();
  await complete.click();
  await page
    .getByRole("dialog", { name: "Complete Session?" })
    .getByRole("button", { name: "Confirm Completion" })
    .click();

  await expect(
    register.getByText("This session is completed. Attendance is read-only."),
  ).toBeVisible();
  await expect(complete).toHaveCount(0);
  await expect(
    register.getByRole("button", { name: "Save attendance" }),
  ).toHaveCount(0);
  expect(api.getCompletionRequests()).toBe(1);
  expect(api.attendanceWrites).toHaveLength(0);
});
