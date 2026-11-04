import { test, expect, type Page } from "@playwright/test";

const classes = ["class-a", "class-b"].map((id) => ({
  id,
  name: id,
  teacher: { user: { fullName: "Test Teacher" } },
}));
const session = (id: string, status = "SCHEDULED") => ({
  id,
  classId: "class-a",
  scheduleId: null,
  startsAt: "2026-11-04T08:00:00Z",
  endsAt: "2026-11-04T09:00:00Z",
  status,
  attendanceCount: 3,
});
const list = (
  items: unknown[],
  page = 1,
  total = items.length,
  totalPages = 1,
) => ({
  items,
  pagination: { page, limit: 10, total, totalPages },
});

// Session-list tests also load the selected session's attendance now.
// Individual attendance tests override this default route.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/sessions/*/attendance", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          session: { ...session("selected"), className: "Test class" },
          students: [],
          summary: { present: 0, absent: 0, unmarked: 0 },
        },
      },
    }),
  );
});

async function open(page: Page, role = "TEACHER") {
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
            id: "user",
            fullName: "Test User",
            role,
            email: "test@example.com",
          },
        },
      },
    }),
  );
  await page.route(/\/api\/classes\?/, (route) =>
    route.fulfill({ json: { success: true, data: list(classes) } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  await expect(page.getByLabel("Class", { exact: true })).toBeVisible();
}

test("loads authorized classes, filters and pages sessions, selects without writes", async ({
  page,
}) => {
  const requests: URL[] = [];
  await page.route("**/api/classes/*/sessions?*", async (route) => {
    expect(route.request().method()).toBe("GET");
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    const url = new URL(route.request().url());
    requests.push(url);
    const filtered = url.searchParams.get("status");
    await route.fulfill({
      json: {
        success: true,
        data: filtered
          ? list([session("completed", filtered)])
          : list(
              [session("scheduled"), session("cancelled", "CANCELLED")],
              Number(url.searchParams.get("page")),
              12,
              2,
            ),
      },
    });
  });
  await open(page);
  await expect(page.getByText("Your assigned classes")).toBeVisible();
  await page.getByLabel("Class", { exact: true }).selectOption("class-a");
  await expect(
    page.getByRole("cell", { name: "SCHEDULED", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Select session" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Selected session" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next sessions" }).click();
  await expect(page.getByText("12 sessions · Page 2 of 2")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Selected session" }),
  ).toHaveCount(0);
  await page.getByLabel("Status", { exact: true }).selectOption("COMPLETED");
  await expect(
    page.getByRole("cell", { name: "COMPLETED", exact: true }),
  ).toBeVisible();
  expect(requests.at(-1)?.searchParams.get("page")).toBe("1");
  expect(requests.at(-1)?.searchParams.get("status")).toBe("COMPLETED");
  await expect(
    page.getByRole("button", { name: /Save|Complete session/ }),
  ).toHaveCount(0);
});

test("shows loading, forbidden error, retry and empty state", async ({
  page,
}) => {
  let forbidden = true;
  await page.route("**/api/classes/*/sessions?*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fulfill(
      forbidden
        ? {
            status: 403,
            json: { success: false, error: { code: "FORBIDDEN" } },
          }
        : { json: { success: true, data: list([]) } },
    );
  });
  await open(page, "ADMIN");
  await expect(page.getByText("All active classes")).toBeVisible();
  await page.getByLabel("Class", { exact: true }).selectOption("class-a");
  await expect(page.getByText("Loading sessions…")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "You do not have permission",
  );
  forbidden = false;
  await page.getByRole("button", { name: "Retry sessions" }).click();
  await expect(
    page.getByText("No sessions have been scheduled for this class."),
  ).toBeVisible();
});

test("ignores an old class response after switching classes", async ({
  page,
}) => {
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/classes/*/sessions?*", async (route) => {
    const old = route.request().url().includes("class-a");
    if (old) await delayed;
    await route.fulfill({
      json: {
        success: true,
        data: list([
          session(
            old ? "old-session" : "new-session",
            old ? "SCHEDULED" : "CANCELLED",
          ),
        ]),
      },
    });
  });
  await open(page);
  await page.getByLabel("Class", { exact: true }).selectOption("class-a");
  await expect(page.getByText("Loading sessions…")).toBeVisible();
  await page.getByLabel("Class", { exact: true }).selectOption("class-b");
  await expect(
    page.getByRole("cell", { name: "CANCELLED", exact: true }),
  ).toBeVisible();
  release();
  await page.getByRole("button", { name: "Select session" }).click();
  await expect(page.getByText("Session ID: new-session")).toBeVisible();
  await expect(
    page.getByText("This session is cancelled. Attendance cannot be recorded."),
  ).toBeVisible();
});

test("attendance table uses GET data, null is Unmarked, and terminal sessions are read-only", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/sessions\//.test(request.url()) && request.method() !== "GET")
      writes.push(request.method());
  });
  await page.route("**/api/classes/*/sessions?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: list([session("one", "COMPLETED"), session("two", "CANCELLED")]),
      },
    }),
  );
  await page.route("**/api/sessions/*/attendance", async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    const cancelled = route.request().url().includes("/two/");
    await route.fulfill({
      json: {
        success: true,
        data: {
          session: {
            ...session(
              cancelled ? "two" : "one",
              cancelled ? "CANCELLED" : "COMPLETED",
            ),
            className: "English A",
          },
          students: ["PRESENT", "ABSENT", null].map((attendanceStatus, i) => ({
            enrollmentId: `e${i}`,
            studentId: `s${i}`,
            studentCode: `ST${i}`,
            fullName: `Student ${i}`,
            attendanceStatus,
            note: null,
            markedAt: null,
          })),
          summary: { present: 1, absent: 1, unmarked: 1 },
        },
      },
    });
  });
  await open(page);
  await page.getByLabel("Class", { exact: true }).selectOption("class-a");
  await page.getByRole("button", { name: "Select session" }).first().click();
  const register = page.getByRole("region", {
    name: "Session attendance",
    exact: true,
  });
  await expect(
    register.getByRole("cell", { name: "Unmarked", exact: true }),
  ).toBeVisible();
  await expect(
    register.getByRole("cell", { name: "PRESENT", exact: true }),
  ).toBeVisible();
  await expect(
    register.getByRole("cell", { name: "ABSENT", exact: true }),
  ).toBeVisible();
  await expect(
    register.getByText("This session is completed. Attendance is read-only."),
  ).toBeVisible();
  await expect(register.getByLabel("Attendance summary")).toContainText(
    "Present1Absent1Unmarked1",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    register.getByRole("region", { name: "Attendance table" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Select session", exact: true })
    .click();
  await expect(
    register.getByText("This session is cancelled. Attendance is read-only."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Save|Complete session|Mark all/ }),
  ).toHaveCount(0);
  expect(writes).toEqual([]);
});

test("attendance loading, errors, retry and empty eligible roster", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/classes/*/sessions?*", (route) =>
    route.fulfill({ json: { success: true, data: list([session("one")]) } }),
  );
  await page.route("**/api/sessions/*/attendance", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill(
      fail
        ? {
            status: 403,
            json: { success: false, error: { code: "FORBIDDEN" } },
          }
        : {
            json: {
              success: true,
              data: {
                session: { ...session("one"), className: "Empty class" },
                students: [],
                summary: { present: 0, absent: 0, unmarked: 0 },
              },
            },
          },
    );
  });
  await open(page, "ADMIN");
  await page.getByLabel("Class", { exact: true }).selectOption("class-a");
  await page.getByRole("button", { name: "Select session" }).click();
  await expect(page.getByText("Loading attendance…")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "You do not have permission to view this session's attendance.",
  );
  fail = false;
  await page.getByRole("button", { name: "Retry attendance" }).click();
  await expect(
    page.getByText("No students are eligible for this session."),
  ).toBeVisible();
});

async function openEditor(page: Page, saveStatus = 200, refreshFails = false) {
  let stored: string | null = null;
  let reads = 0;
  const writes: unknown[] = [];
  await page.route("**/api/classes/*/sessions?*", (route) =>
    route.fulfill({
      json: { success: true, data: list([session("one"), session("two")]) },
    }),
  );
  await page.route("**/api/sessions/*/attendance", async (route) => {
    if (route.request().method() === "PUT") {
      writes.push(route.request().postDataJSON());
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (saveStatus !== 200) {
        await route.fulfill({
          status: saveStatus,
          json: { success: false, error: { code: "TEST_ERROR" } },
        });
        return;
      }
      stored = route.request().postDataJSON().records[0].status;
      await route.fulfill({
        json: {
          success: true,
          data: {
            sessionId: "one",
            updatedCount: 1,
            records: route.request().postDataJSON().records,
            markedAt: new Date().toISOString(),
          },
        },
      });
      return;
    }
    reads++;
    if (refreshFails && stored) {
      await route.fulfill({
        status: 500,
        json: { success: false, error: { code: "TEST_ERROR" } },
      });
      return;
    }
    await route.fulfill({
      json: {
        success: true,
        data: {
          session: { ...session("one"), className: "Test class" },
          students: [stored, "PRESENT", "ABSENT"].map(
            (attendanceStatus, i) => ({
              enrollmentId: `e${i}`,
              studentId: `s${i}`,
              studentCode: `ST${i}`,
              fullName: `Student ${i}`,
              attendanceStatus,
              note: null,
              markedAt: null,
            }),
          ),
          summary: {
            present: stored === "PRESENT" ? 2 : 1,
            absent: 1,
            unmarked: stored ? 0 : 1,
          },
        },
      },
    });
  });
  await open(page);
  await page.getByLabel("Class", { exact: true }).selectOption("class-a");
  await page.getByRole("button", { name: "Select session" }).first().click();
  await expect(
    page.getByLabel("Attendance for Student 0 (ST0)", { exact: true }),
  ).toBeVisible();
  return { writes, reads: () => reads };
}

test("editor sends only changed marked records, guards navigation, locks while saving and refetches", async ({
  page,
}) => {
  const state = await openEditor(page);
  const first = page.getByLabel("Attendance for Student 0 (ST0)", {
    exact: true,
  });
  const second = page.getByLabel("Attendance for Student 1 (ST1)", {
    exact: true,
  });
  const save = page.getByRole("button", {
    name: "Save attendance",
    exact: true,
  });
  await expect(save).toBeDisabled();
  await first.selectOption("PRESENT");
  await first.selectOption("");
  await expect(save).toBeDisabled();
  await second.selectOption("ABSENT");
  await second.selectOption("PRESENT");
  await first.selectOption("PRESENT");
  await expect(
    page.getByText("1 unsaved change", { exact: true }),
  ).toBeVisible();
  for (const leave of [
    () =>
      page.getByRole("button", { name: "Select session", exact: true }).click(),
    () => page.getByLabel("Class", { exact: true }).selectOption("class-b"),
    () => page.getByRole("button", { name: "Dashboard", exact: true }).click(),
    () =>
      page
        .getByRole("button", { name: "Clear selection", exact: true })
        .click(),
    () => page.getByLabel("Status", { exact: true }).selectOption("COMPLETED"),
  ]) {
    page.once("dialog", (dialog) => dialog.dismiss());
    await leave();
    await expect(first).toHaveValue("PRESENT");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const unloadBlocked = await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(unloadBlocked).toBe(true);
  const readsBeforeSave = state.reads();
  await save.click();
  await expect(first).toBeDisabled();
  await expect(save).toBeDisabled();
  await expect(page.getByText("Attendance saved successfully.")).toBeVisible();
  expect(state.writes).toEqual([
    { records: [{ enrollmentId: "e0", status: "PRESENT" }] },
  ]);
  expect(state.reads()).toBe(readsBeforeSave + 1);
  await expect(save).toBeDisabled();
  await expect(page.getByLabel("Attendance summary")).toContainText(
    "Present2Absent1Unmarked0",
  );
});

for (const status of [403, 409, 500, 401]) {
  test(`save handles ${status} without reporting success`, async ({ page }) => {
    const state = await openEditor(page, status);
    const first = page.getByLabel("Attendance for Student 0 (ST0)", {
      exact: true,
    });
    await first.selectOption("ABSENT");
    await page
      .getByRole("button", { name: "Save attendance", exact: true })
      .click();
    if (status === 401) {
      await expect(
        page.getByRole("button", { name: /Sign in|Log in/i }),
      ).toBeVisible();
    } else {
      await expect(page.getByRole("alert")).toContainText(
        status === 403
          ? "permission"
          : status === 409
            ? "session changed"
            : "Unable to save",
      );
      await expect(
        page.getByText("1 unsaved change", { exact: true }),
      ).toBeVisible();
      if (status === 500) await expect(first).toHaveValue("ABSENT");
      else
        await expect(
          page.getByRole("button", { name: "Save attendance", exact: true }),
        ).toHaveCount(0);
    }
    expect(state.writes).toEqual([
      { records: [{ enrollmentId: "e0", status: "ABSENT" }] },
    ]);
    await expect(page.getByText("Attendance saved successfully.")).toHaveCount(
      0,
    );
  });
}

test("successful write followed by failed refresh cannot be resent", async ({
  page,
}) => {
  const state = await openEditor(page, 200, true);
  await page
    .getByLabel("Attendance for Student 0 (ST0)", { exact: true })
    .selectOption("PRESENT");
  await page
    .getByRole("button", { name: "Save attendance", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Attendance was saved");
  await expect(
    page.getByRole("button", { name: "Save attendance", exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});

test("confirmed navigation discards the draft without writing", async ({
  page,
}) => {
  const state = await openEditor(page);
  await page
    .getByLabel("Attendance for Student 0 (ST0)", { exact: true })
    .selectOption("ABSENT");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Selected session" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Select session" }).first().click();
  await expect(
    page.getByLabel("Attendance for Student 0 (ST0)", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Save attendance", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});
