import { test, expect, type Page } from "@playwright/test";

const classes = ["class-a", "class-b"].map(id => ({ id, name: id, teacher: { user: { fullName: "Test Teacher" } } }));
const session = (id: string, status = "SCHEDULED") => ({
  id, classId: "class-a", scheduleId: null, startsAt: "2026-11-04T08:00:00Z",
  endsAt: "2026-11-04T09:00:00Z", status, attendanceCount: 3,
});
const list = (items: unknown[], page = 1, total = items.length, totalPages = 1) => ({
  items, pagination: { page, limit: 10, total, totalPages },
});

async function open(page: Page, role = "TEACHER") {
  await page.addInitScript(() => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    sessionStorage.setItem("classflow_access_token", `test.${payload}.test`);
  });
  await page.route("**/api/auth/me", route => route.fulfill({ json: { success: true, data: { user: { id: "user", fullName: "Test User", role, email: "test@example.com" } } } }));
  await page.route(/\/api\/classes\?/, route => route.fulfill({ json: { success: true, data: list(classes) } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  await expect(page.getByLabel("Class", { exact: true })).toBeVisible();
}

test("loads authorized classes, filters and pages sessions, selects without writes", async ({ page }) => {
  const requests: URL[] = [];
  await page.route("**/api/classes/*/sessions?*", async route => {
    expect(route.request().method()).toBe("GET");
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    const url = new URL(route.request().url());
    requests.push(url);
    const filtered = url.searchParams.get("status");
    await route.fulfill({ json: { success: true, data: filtered ? list([session("completed", filtered)]) : list([session("scheduled"), session("cancelled", "CANCELLED")], Number(url.searchParams.get("page")), 12, 2) } });
  });
  await open(page);
  await expect(page.getByText("Your assigned classes")).toBeVisible();
  await page.getByLabel("Class", { exact: true }).selectOption("class-a");
  await expect(page.getByRole("cell", { name: "SCHEDULED", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Select session" }).first().click();
  await expect(page.getByRole("heading", { name: "Selected session" })).toBeVisible();
  await page.getByRole("button", { name: "Next sessions" }).click();
  await expect(page.getByText("12 sessions · Page 2 of 2")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Selected session" })).toHaveCount(0);
  await page.getByLabel("Status", { exact: true }).selectOption("COMPLETED");
  await expect(page.getByRole("cell", { name: "COMPLETED", exact: true })).toBeVisible();
  expect(requests.at(-1)?.searchParams.get("page")).toBe("1");
  expect(requests.at(-1)?.searchParams.get("status")).toBe("COMPLETED");
  await expect(page.getByRole("button", { name: /Save|Complete session/ })).toHaveCount(0);
});

test("shows loading, forbidden error, retry and empty state", async ({ page }) => {
  let forbidden = true;
  await page.route("**/api/classes/*/sessions?*", async route => {
    await new Promise(resolve => setTimeout(resolve, 200));
    await route.fulfill(forbidden
      ? { status: 403, json: { success: false, error: { code: "FORBIDDEN" } } }
      : { json: { success: true, data: list([]) } });
  });
  await open(page, "ADMIN");
  await expect(page.getByText("All active classes")).toBeVisible();
  await page.getByLabel("Class", { exact: true }).selectOption("class-a");
  await expect(page.getByText("Loading sessions…")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("You do not have permission");
  forbidden = false;
  await page.getByRole("button", { name: "Retry sessions" }).click();
  await expect(page.getByText("No sessions have been scheduled for this class.")).toBeVisible();
});

test("ignores an old class response after switching classes", async ({ page }) => {
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/classes/*/sessions?*", async route => {
    const old = route.request().url().includes("class-a");
    if (old) await delayed;
    await route.fulfill({ json: { success: true, data: list([session(old ? "old-session" : "new-session", old ? "SCHEDULED" : "CANCELLED")]) } });
  });
  await open(page);
  await page.getByLabel("Class", { exact: true }).selectOption("class-a");
  await expect(page.getByText("Loading sessions…")).toBeVisible();
  await page.getByLabel("Class", { exact: true }).selectOption("class-b");
  await expect(page.getByRole("cell", { name: "CANCELLED", exact: true })).toBeVisible();
  release();
  await page.getByRole("button", { name: "Select session" }).click();
  await expect(page.getByText("Session ID: new-session")).toBeVisible();
  await expect(page.getByText("This session is cancelled. Attendance cannot be recorded.")).toBeVisible();
});
