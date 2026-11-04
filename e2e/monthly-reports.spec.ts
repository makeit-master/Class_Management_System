import { test, expect, type Page } from "@playwright/test";

const classId = "00000000-0000-4000-8000-000000000011";
const month = "2026-11";
const classData = {
  id: classId,
  name: "Mathematics A",
  teacher: { user: { fullName: "Teacher A" } },
};
const people = [
  {
    enrollmentId: "e1",
    studentId: "s1",
    studentCode: "ST1",
    fullName: "Student A",
    enrollmentStatus: "ACTIVE" as const,
    eligibleSessions: 3,
    present: 2,
    absent: 1,
    unmarked: 0,
    attendanceRate: 66.7,
  },
  {
    enrollmentId: "e2",
    studentId: "s2",
    studentCode: "ST2",
    fullName: "Student B",
    enrollmentStatus: "DROPPED" as const,
    eligibleSessions: 2,
    present: 1,
    absent: 1,
    unmarked: 0,
    attendanceRate: 50,
  },
];
const report = {
  class: { id: classId, name: "Mathematics A" },
  month,
  timeZone: "Asia/Ho_Chi_Minh",
  period: { from: "2026-10-31T17:00:00Z", toExclusive: "2026-11-30T17:00:00Z" },
  sessions: { completed: 3, scheduled: 1, cancelled: 1 },
  totals: {
    students: 2,
    eligibleSessions: 5,
    present: 3,
    absent: 2,
    unmarked: 0,
    attendanceRate: 60,
  },
  students: people,
};

test.beforeEach(async ({ page }) => {
  // Registered first so individual test-specific routes can override it.
  // Unmatched calls never reach Supabase or a live backend.
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 501,
      json: { success: false, error: { code: "UNMOCKED" } },
    }),
  );
});

async function openReports(page: Page, role = "ADMIN") {
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
            email: "test@example.com",
            role,
          },
        },
      },
    }),
  );
  await page.route(/\/api\/classes\?/, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          items: [classData],
          pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
        },
      },
    }),
  );
  await page.route(`**/api/classes/${classId}/attendance/monthly?*`, (route) =>
    route.fulfill({ json: { success: true, data: report } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Monthly reports/ }),
  ).toBeVisible();
  await page.getByLabel("Report month").fill(month);
}

test("M19.2 displays completed-only monthly attendance, history and CSV export", async ({
  page,
}) => {
  await openReports(page);
  await expect(
    page.getByRole("region", { name: "Monthly report" }),
  ).toBeVisible();
  const reportRegion = page.getByRole("region", { name: "Monthly report" });
  await expect(reportRegion.getByText("60.0%", { exact: true })).toBeVisible();
  await expect(
    reportRegion.getByText("1 scheduled · 1 cancelled (excluded)"),
  ).toBeVisible();
  await expect(
    reportRegion.getByRole("row", { name: /Student B/ }),
  ).toContainText("DROPPED");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export CSV" }).click(),
  ]);
  expect(download.suggestedFilename()).toContain(
    "classflow-attendance-2026-11",
  );
});

test("M19.3-4 admin saves a month-effective VND rate and sees PRESENT-only estimate", async ({
  page,
}) => {
  let amountVnd: number | null = null;
  let putCount = 0;
  await page.route(`**/api/classes/${classId}/tuition/monthly?*`, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          ...report,
          pricing: {
            currency: "VND",
            billableStatus: "PRESENT",
            absenceBillable: false,
            effectiveMonth: amountVnd === null ? null : month,
            amountPerSessionVnd: amountVnd,
            ready: amountVnd !== null,
            warning:
              amountVnd === null
                ? "No tuition rate is configured for this class and month."
                : null,
          },
          totals: {
            ...report.totals,
            billableSessions: 3,
            amountVnd: amountVnd === null ? null : 3 * amountVnd,
          },
          students: people.map((student) => ({
            ...student,
            billableSessions: student.present,
            amountVnd: amountVnd === null ? null : student.present * amountVnd,
          })),
        },
      },
    }),
  );
  await page.route(
    `**/api/classes/${classId}/tuition/rates/${month}`,
    (route) => {
      expect(route.request().method()).toBe("PUT");
      expect(route.request().headers().authorization).toMatch(/^Bearer /);
      putCount++;
      amountVnd = (route.request().postDataJSON() as { amountVnd: number })
        .amountVnd;
      return route.fulfill({
        json: {
          success: true,
          data: { classId, currency: "VND", effectiveMonth: month, amountVnd },
        },
      });
    },
  );
  await openReports(page);
  await page.getByRole("tab", { name: "Tuition estimates" }).click();
  await expect(
    page.getByText("No tuition rate is configured for this class and month."),
  ).toBeVisible();
  await page.getByLabel("Tuition rate (VND)").fill("125000");
  await page.getByRole("button", { name: `Save rate from ${month}` }).click();
  await expect(
    page
      .getByRole("region", { name: "Monthly report" })
      .getByText(/375[.\s]?000/)
      .first(),
  ).toBeVisible();
  expect(putCount).toBe(1);
  const rows = page.getByRole("row");
  await expect(rows.filter({ hasText: "Student A" })).toContainText(
    /250[.\s]?000/,
  );
  await expect(rows.filter({ hasText: "Student B" })).toContainText(
    /125[.\s]?000/,
  );
});

test("teachers can view tuition but cannot edit the class rate", async ({
  page,
}) => {
  await page.route(`**/api/classes/${classId}/tuition/monthly?*`, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          ...report,
          pricing: {
            currency: "VND",
            billableStatus: "PRESENT",
            absenceBillable: false,
            effectiveMonth: month,
            amountPerSessionVnd: 100000,
            ready: true,
            warning: null,
          },
          totals: { ...report.totals, billableSessions: 3, amountVnd: 300000 },
          students: people.map((p) => ({
            ...p,
            billableSessions: p.present,
            amountVnd: p.present * 100000,
          })),
        },
      },
    }),
  );
  await openReports(page, "TEACHER");
  await page.getByRole("tab", { name: "Tuition estimates" }).click();
  await expect(
    page.getByRole("region", { name: "Monthly report" }),
  ).toBeVisible();
  await expect(page.getByLabel("Tuition rate (VND)")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: `Save rate from ${month}` }),
  ).toHaveCount(0);
});

test("monthly reports inherit both themes and fit desktop, tablet and mobile", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openReports(page);
  await expect(
    page.getByRole("region", { name: "Monthly report", exact: true }),
  ).toBeVisible();
  for (const theme of ["dark", "light"]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    if (theme === "light")
      await page
        .getByRole("button", { name: "Light Mode", exact: true })
        .click();
    for (const width of [1440, 820, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.locator(".app-container")).toHaveClass(
        new RegExp(`${theme}-theme`),
      );
      // React responds to the viewport's media-query event asynchronously.
      await expect.poll(() => page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      )).toBe(true);
      const colors = await page
        .locator(".monthly-card")
        .first()
        .evaluate((element) => ({
          actual: getComputedStyle(element).backgroundColor,
          expected: getComputedStyle(element)
            .getPropertyValue("--surface")
            .trim(),
        }));
      expect(colors.actual).toBe(
        theme === "dark" ? "rgb(17, 17, 20)" : "rgb(255, 255, 255)",
      );
      await page.screenshot({
        path: testInfo.outputPath(`reports-${theme}-${width}.png`),
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
});

test("report errors can be retried and an empty month is clearly displayed", async ({
  page,
}) => {
  let failing = true;
  await openReports(page);
  await page.route(`**/api/classes/${classId}/attendance/monthly?*`, (route) =>
    route.fulfill(
      failing
        ? {
            status: 500,
            json: {
              success: false,
              error: { message: "Report temporarily unavailable" },
            },
          }
        : {
            json: {
              success: true,
              data: {
                ...report,
                students: [],
                sessions: { completed: 0, scheduled: 0, cancelled: 0 },
                totals: {
                  students: 0,
                  eligibleSessions: 0,
                  present: 0,
                  absent: 0,
                  unmarked: 0,
                  attendanceRate: null,
                },
              },
            },
          },
    ),
  );
  await expect(
    page.getByRole("region", { name: "Monthly report", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Report temporarily unavailable",
  );
  failing = false;
  await page.getByRole("button", { name: "Retry report" }).click();
  await expect(
    page.getByText("No enrollment activity overlaps this month."),
  ).toBeVisible();
  await expect(page.getByText("N/A", { exact: true })).toBeVisible();
});
