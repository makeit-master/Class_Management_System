import { test, expect } from "@playwright/test";
test("teacher forms persist through reload and show API conflicts", async ({
  page,
}) => {
  let teacher = {
    id: "00000000-0000-4000-8000-000000000020",
    employeeCode: "EMP20",
    subject: "Math",
    phone: "",
    bio: "",
    user: {
      fullName: "Teacher Twenty",
      email: "twenty@test.com",
      isActive: true,
    },
    classes: [],
  };
  let created = false;
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "classflow_access_token",
      `test.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.test`,
    );
  });
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 501,
      json: { success: false, error: { message: "Unmocked request" } },
    }),
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          user: {
            id: "admin",
            fullName: "Admin",
            role: "ADMIN",
            email: "admin@test.com",
          },
        },
      },
    }),
  );
  await page.route("**/api/teachers**", async (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      if (created)
        return route.fulfill({
          status: 409,
          json: {
            success: false,
            error: { message: "Email or employee code is already in use" },
          },
        });
      const body = req.postDataJSON();
      teacher = {
        ...teacher,
        user: { ...teacher.user, fullName: body.fullName, email: body.email },
      };
      created = true;
    } else if (req.method() === "PATCH") {
      if (req.url().endsWith("/deactivate")) teacher.user.isActive = false;
      else if (req.url().endsWith("/reactivate")) teacher.user.isActive = true;
      else teacher = { ...teacher, subject: req.postDataJSON().subject };
    }
    return route.fulfill({
      json: {
        success: true,
        data: req.url().includes("?")
          ? {
              items: created ? [teacher] : [],
              pagination: { total: created ? 1 : 0, totalPages: 1 },
            }
          : teacher,
      },
    });
  });
  const open = async () => {
    await page.goto("/");
    await page.getByRole("button", { name: "Teachers", exact: true }).click();
  };
  await open();
  await expect(page.getByText("No teachers found")).toBeVisible();
  await page.getByRole("button", { name: "Add Teacher", exact: true }).click();
  await page.getByLabel("Full name").fill("Persisted Teacher");
  await page.getByLabel("Email address").fill("persisted@test.com");
  await page.getByLabel("Initial password").fill("Secure-test-1234");
  await page.getByRole("button", { name: "Save teacher" }).click();
  await expect(
    page.getByRole("heading", { name: "Persisted Teacher" }),
  ).toBeVisible();
  await open();
  await expect(
    page.getByRole("heading", { name: "Persisted Teacher" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit Persisted Teacher" }).click();
  await page.getByLabel("Subject", { exact: true }).fill("Physics");
  await page.getByRole("button", { name: "Save teacher" }).click();
  await expect(page.getByText("Physics", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View profile" }).click();
  await page.getByRole("button", { name: "Deactivate", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("Inactive", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "docs/evidence/m20-teachers-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "View profile" }).click();
  await page.getByRole("button", { name: "Reactivate", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Light Mode", exact: true }).click();
  await page.screenshot({
    path: "docs/evidence/m20-teachers-light.png",
    fullPage: true,
  });
  for (const width of [820, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Add Teacher", exact: true }).click();
  await page.getByLabel("Full name").fill("Duplicate");
  await page.getByLabel("Email address").fill("persisted@test.com");
  await page.getByLabel("Initial password").fill("Secure-test-1234");
  await page.getByRole("button", { name: "Save teacher" }).click();
  await expect(page.getByRole("alert")).toContainText("already in use");
});
