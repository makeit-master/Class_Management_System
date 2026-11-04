import { test, expect } from "@playwright/test";
test("registration blocks incomplete and mismatched fields, displays backend errors, supports mobile themes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Sign up", exact: true }).click();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByText("Enter 2 to 120 characters")).toBeVisible();
  await page.getByLabel("Full name", { exact: true }).fill("Test Person");
  await page.getByLabel("Date of birth").fill("2000-02-29");
  await page
    .getByLabel("Gender", { exact: true })
    .selectOption("PREFER_NOT_TO_SAY");
  await page.getByLabel("Phone number").fill("0912345678");
  await page.getByLabel("Email address").fill("test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Long-password-123");
  await page.getByLabel("Confirm password").fill("wrong");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByText("Passwords must match")).toBeVisible();
  await page.getByLabel("Confirm password").fill("Long-password-123");
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        error: {
          message: "Check the highlighted fields",
          fields: { phone: ["Enter a valid Vietnamese phone number"] },
        },
      }),
    }),
  );
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByLabel("Phone number")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Switch color theme" }).click();
  await expect(page.locator(".cf-login")).toHaveClass(/cf-login--light/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

const pendingProfile = {
  id: "applicant",
  fullName: "Alex Nguyen",
  email: "alex@example.com",
  dateOfBirth: "2004-04-12",
  gender: "PREFER_NOT_TO_SAY",
  phone: "+84912345678",
  address: null,
  profileCompletedAt: "2026-11-04",
  emailVerifiedAt: "2026-11-04",
  registrationStatus: "PENDING",
};
test("focused routes, verification, Google profile completion, approval states and empty status password", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByText("Your session has expired.", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Check registration status" }).click();
  await expect(page).toHaveURL(/registration-status$/);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "autocomplete",
    "current-password",
  );
  await page.route("**/api/auth/registration-login", (r) =>
    r.fulfill({
      json: {
        success: true,
        data: { registrationToken: "registration-test-session" },
      },
    }),
  );
  let profile = { ...pendingProfile };
  await page.route("**/api/auth/registration", (r) =>
    r.fulfill({ json: { success: true, data: profile } }),
  );
  await page.getByLabel("Email address").fill("alex@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Long-password-123");
  await page.getByRole("button", { name: "Check status", exact: true }).click();
  await expect(page).toHaveURL(/pending-approval$/);
  await expect(
    page.getByRole("heading", { name: "You're on the list" }),
  ).toBeVisible();
  profile = { ...profile, registrationStatus: "APPROVED" };
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(page).toHaveURL(/registration-status$/);
  await expect(
    page.getByRole("heading", { name: "You're approved" }),
  ).toBeVisible();
  profile = { ...profile, registrationStatus: "REJECTED" };
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Registration not approved" }),
  ).toBeVisible();
  await page.route("**/api/auth/registration", (r) =>
    r.fulfill({
      json: {
        success: true,
        data: {
          ...pendingProfile,
          profileCompletedAt: null,
          dateOfBirth: null,
          phone: null,
          gender: null,
        },
      },
    }),
  );
  await page.goto("/complete-profile");
  await expect(
    page.getByRole("heading", { name: "Complete your profile" }),
  ).toBeVisible();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Alex Nguyen",
  );
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByLabel("Date of birth").fill("2010-01-01");
  await page.getByLabel("Gender", { exact: true }).selectOption("OTHER");
  await page.getByLabel("Phone number").fill("0912345678");
  await page.getByRole("checkbox").check();
  await page.route("**/api/auth/complete-profile", async (r) => {
    expect(r.request().postDataJSON()).not.toHaveProperty("password");
    await r.fulfill({
      json: { success: true, data: { message: "Profile submitted" } },
    });
  });
  await page.route("**/api/auth/registration", (r) =>
    r.fulfill({ json: { success: true, data: pendingProfile } }),
  );
  await page.getByRole("button", { name: "Submit profile" }).click();
  await expect(page).toHaveURL(/pending-approval$/);
});
test("successful registration leads to verification screen without unrelated forms", async ({
  page,
}) => {
  await page.route("**/api/auth/register", (r) =>
    r.fulfill({
      json: { success: true, data: { message: "Check your email" } },
    }),
  );
  await page.goto("/register");
  await page.getByLabel("Full name", { exact: true }).fill("Test Person");
  await page.getByLabel("Date of birth").fill("2010-01-01");
  await page.getByLabel("Gender", { exact: true }).selectOption("OTHER");
  await page.getByLabel("Phone number").fill("0912345678");
  await page.getByLabel("Email address").fill("test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Long-password-123");
  await page.getByLabel("Confirm password").fill("Long-password-123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/registration-status$/);
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  await expect(page.locator("form")).toHaveCount(0);
  await page.route("**/api/auth/verify-email", (r) =>
    r.fulfill({
      json: {
        success: true,
        data: { registrationToken: "verified-test-session" },
      },
    }),
  );
  await page.route("**/api/auth/registration", (r) =>
    r.fulfill({ json: { success: true, data: pendingProfile } }),
  );
  await page.goto("/#verify=" + "a".repeat(64));
  await expect(page).toHaveURL(/pending-approval$/);
});
test("desktop and mobile authentication screenshots", async ({ page }) => {
  await page.goto("/login");
  await page.evaluate(() => {
    localStorage.removeItem("classflow_auth_theme");
    sessionStorage.clear();
  });
  for (const [width, height, label] of [
    [1440, 1100, "desktop"],
    [390, 844, "mobile"],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const path of ["login", "register", "registration-status"]) {
      await page.goto("/" + path);
      await expect(page.locator("h1")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `artifacts/auth-ui/${path}-${label}-dark.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page.getByRole("button", { name: "Switch color theme" }).click();
      await page.screenshot({
        path: `artifacts/auth-ui/${path}-${label}-light.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Switch color theme" }).click();
    }
    await page.route("**/api/auth/registration", (r) =>
      r.fulfill({
        json: {
          success: true,
          data: { ...pendingProfile, profileCompletedAt: null },
        },
      }),
    );
    await page.evaluate(() =>
      sessionStorage.setItem(
        "classflow_registration_token",
        "screenshot-test-session",
      ),
    );
    await page.goto("/complete-profile");
    await expect(
      page.getByRole("heading", { name: "Complete your profile" }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/auth-ui/complete-profile-${label}-dark.png`,
      fullPage: true,
    });
    await page.unroute("**/api/auth/registration");
    await page.route("**/api/auth/registration", (r) =>
      r.fulfill({ json: { success: true, data: pendingProfile } }),
    );
    await page.goto("/pending-approval");
    await expect(
      page.getByRole("heading", { name: "You're on the list" }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/auth-ui/pending-approval-${label}-dark.png`,
      fullPage: true,
    });
    await page.evaluate(() => sessionStorage.clear());
    await page.unroute("**/api/auth/registration");
  }
});

for (const role of ["ADMIN", "TEACHER"] as const) {
  test(`${role} email sign-in reaches the existing application`, async ({
    page,
  }) => {
    const token = `test.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 })).toString("base64")}.test`;
    await page.route("**/api/**", (r) =>
      r.fulfill({ json: { success: true, data: [] } }),
    );
    await page.route("**/api/auth/login", (r) => {
      expect(r.request().postDataJSON()).toEqual({
        email: "existing@example.com",
        password: "Existing-password-123",
      });
      return r.fulfill({
        json: { success: true, data: { accessToken: token } },
      });
    });
    await page.route("**/api/auth/me", (r) =>
      r.fulfill({
        json: {
          success: true,
          data: {
            user: {
              id: "existing",
              fullName: "Existing User",
              email: "existing@example.com",
              role,
            },
          },
        },
      }),
    );
    await page.goto("/login");
    await page.getByLabel("Email address").fill("existing@example.com");
    await page
      .getByLabel("Password", { exact: true })
      .fill("Existing-password-123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL("http://127.0.0.1:5173/");
    await expect(page.locator(".app-container")).toBeVisible();
  });
}
test("fresh and malformed sessions do not display expiry; truly expired sessions do", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("expiry_test_initialized")) {
      sessionStorage.setItem("classflow_access_token", "malformed");
      sessionStorage.setItem("expiry_test_initialized", "true");
    }
  });
  await page.goto("/login");
  await expect(page.getByRole("heading")).toBeVisible();
  await expect(
    page.getByText("Your session has expired.", { exact: false }),
  ).toHaveCount(0);
  await page.evaluate(() =>
    sessionStorage.setItem(
      "classflow_access_token",
      `test.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 }))}.test`,
    ),
  );
  await page.reload();
  await expect(
    page.getByText("Your session has expired. Please sign in again."),
  ).toBeVisible();
});
