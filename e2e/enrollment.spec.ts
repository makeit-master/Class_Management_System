import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const API_URL = process.env.E2E_API_URL || "http://127.0.0.1:3000/api";

type EnrollmentItem = {
  id: string;
  status: "ACTIVE" | "DROPPED";
  student: {
    id: string;
    studentCode: string;
  };
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing E2E environment variable: ${name}`);
  }

  return value;
}

async function loginUI(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/");

  await page.getByRole("textbox", { name: "Email address" }).fill(email);

  await page.getByLabel("Password").fill(password);

  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page.getByRole("button", {
      name: "Classes",
      exact: true,
    }),
  ).toBeVisible();
}

async function openEnrollModal(page: Page, studentCode: string) {
  const panel = page.locator(".classes-enrollment-section");

  await panel.getByRole("button", { name: /Enroll Student/ }).click();

  const modal = page.getByRole("dialog", {
    name: "Enroll Student",
  });

  await expect(modal).toBeVisible();

  await modal
    .getByRole("searchbox", { name: "Search students" })
    .fill(studentCode);

  const studentOption = modal
    .locator(".cms-enroll-student")
    .filter({ hasText: studentCode });

  await expect(studentOption).toBeVisible();

  await studentOption.locator('input[type="radio"]').check();

  return modal;
}

test("ADMIN completes Enroll, Drop and Re-enroll lifecycle", async ({
  page,
  request,
}) => {
  // Prevent accidental writes to a production database.
  if (process.env.E2E_ALLOW_DB_WRITES !== "YES") {
    throw new Error(
      "Set E2E_ALLOW_DB_WRITES=YES only for an isolated test database.",
    );
  }

  const email = requiredEnv("E2E_ADMIN_EMAIL");
  const password = requiredEnv("E2E_ADMIN_PASSWORD");
  const className = requiredEnv("E2E_CLASS_NAME");
  const studentCode = requiredEnv("E2E_STUDENT_CODE");

  // ============================================================
  // AUTHENTICATE API TEST CONTEXT
  // ============================================================

  const loginResponse = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });

  expect(loginResponse.status()).toBe(200);

  const loginData = await loginResponse.json();

  const token: string = loginData.data.accessToken;

  expect(token).toBeTruthy();

  const meResponse = await request.get(`${API_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  expect(meResponse.status()).toBe(200);

  const meData = await meResponse.json();

  expect(meData.data.user.role).toBe("ADMIN");

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  // ============================================================
  // FIND DEDICATED TEST CLASS
  // ============================================================

  const classesResponse = await request.get(`${API_URL}/classes`, {
    headers,
    params: {
      search: className,
      page: 1,
      limit: 100,
    },
  });

  expect(classesResponse.status()).toBe(200);

  const classesData = await classesResponse.json();

  const matchingClasses = classesData.data.items.filter(
    (item: { id: string; name: string }) => item.name === className,
  );

  expect(
    matchingClasses,
    `Expected exactly one active test class named "${className}". Found ${matchingClasses.length}. Check E2E_CLASS_NAME and your test database fixtures.`,
  ).toHaveLength(1);

  const classId: string = matchingClasses[0].id;

  // ============================================================
  // FIND DEDICATED TEST STUDENT
  // ============================================================

  const studentsResponse = await request.get(`${API_URL}/students`, {
    headers,
    params: {
      search: studentCode,
      status: "active",
      page: 1,
      limit: 100,
    },
  });

  expect(studentsResponse.status()).toBe(200);

  const studentsData = await studentsResponse.json();

  const student = studentsData.data.items.find(
    (item: { id: string; studentCode: string }) =>
      item.studentCode === studentCode,
  );

  expect(student).toBeDefined();

  const studentId: string = student.id;

  // ============================================================
  // FIND ENROLLMENT BY STATUS
  // ============================================================

  async function findEnrollment(
    status: "ACTIVE" | "DROPPED",
  ): Promise<EnrollmentItem | undefined> {
    let pageNumber = 1;

    while (true) {
      const response = await request.get(`${API_URL}/enrollments`, {
        headers,
        params: {
          classId,
          status,
          page: pageNumber,
          limit: 100,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();

      const match = (body.data.items as EnrollmentItem[]).find(
        (item) => item.student.id === studentId,
      );

      if (match) return match;

      if (pageNumber >= body.data.pagination.totalPages) {
        return undefined;
      }

      pageNumber += 1;
    }
  }

  const originallyActive = await findEnrollment("ACTIVE");

  let originalEnrollmentId =
    originallyActive?.id ?? (await findEnrollment("DROPPED"))?.id;

  try {
    // ==========================================================
    // PREPARE: TEST STUDENT MUST NOT BE ACTIVE
    // ==========================================================

    if (originallyActive) {
      const prepareResponse = await request.patch(
        `${API_URL}/enrollments/${originallyActive.id}/drop`,
        { headers },
      );

      expect(prepareResponse.status()).toBe(200);
    }

    // ==========================================================
    // OPEN CLASSES PAGE
    // ==========================================================

    await loginUI(page, email, password);

    await page
      .getByRole("button", {
        name: "Classes",
        exact: true,
      })
      .click();

    // Wait for the debounced search before opening details. Its state update
    // intentionally closes the previously selected enrollment panel.
    await Promise.all([
      page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          url.pathname === "/api/classes" &&
          url.searchParams.get("search") === className &&
          response.ok()
        );
      }),
      page.getByRole("textbox", { name: "Search classes" }).fill(className),
    ]);

    const classCard = page.locator(".classes-card").filter({
      has: page.getByRole("heading", {
        name: className,
        exact: true,
      }),
    });

    await expect(classCard).toBeVisible();

    const cardCount = classCard.locator(".classes-metadata > span").first();

    const countText = await cardCount.innerText();

    const initialCount = Number(countText.match(/\d+/)?.[0]);

    expect(Number.isFinite(initialCount)).toBe(true);

    await classCard
      .getByRole("button", {
        name: "View class details",
      })
      .click();

    const panel = page.locator(".classes-enrollment-section");

    await expect(panel).toBeVisible();

    // ==========================================================
    // STEP 1: ENROLL
    // ==========================================================

    const enrollModal = await openEnrollModal(page, studentCode);

    const [enrollResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/enrollments") &&
          response.request().method() === "POST",
      ),

      enrollModal
        .getByRole("button", {
          name: "Enroll Student",
          exact: true,
        })
        .click(),
    ]);

    expect([200, 201]).toContain(enrollResponse.status());

    const enrollmentResult = await enrollResponse.json();

    const enrollmentId: string = enrollmentResult.data.enrollment.id;

    if (originalEnrollmentId) {
      expect(enrollmentId).toBe(originalEnrollmentId);
    } else {
      originalEnrollmentId = enrollmentId;
    }

    await expect(cardCount).toContainText(`${initialCount + 1} students`);

    let studentRow = panel
      .locator(".cms-enrollment-table tbody tr")
      .filter({ hasText: studentCode });

    await expect(studentRow).toBeVisible();

    // ==========================================================
    // STEP 2: DROP
    // ==========================================================

    await studentRow.getByRole("button", { name: /Drop/ }).click();

    const dropModal = page.getByRole("dialog", {
      name: "Drop Student?",
    });

    await expect(dropModal).toBeVisible();

    const [dropResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/api/enrollments/${enrollmentId}/drop`) &&
          response.request().method() === "PATCH",
      ),

      dropModal
        .getByRole("button", {
          name: "Confirm Drop",
        })
        .click(),
    ]);

    expect(dropResponse.status()).toBe(200);

    await expect(cardCount).toContainText(`${initialCount} students`);

    await panel
      .getByRole("button", {
        name: "Dropped",
        exact: true,
      })
      .click();

    studentRow = panel
      .locator(".cms-enrollment-table tbody tr")
      .filter({ hasText: studentCode });

    await expect(studentRow).toBeVisible();

    const droppedEnrollment = await findEnrollment("DROPPED");

    expect(droppedEnrollment?.id).toBe(enrollmentId);

    // ==========================================================
    // STEP 3: RE-ENROLL
    // ==========================================================

    const reenrollModal = await openEnrollModal(page, studentCode);

    const [reenrollResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/enrollments") &&
          response.request().method() === "POST",
      ),

      reenrollModal
        .getByRole("button", {
          name: "Enroll Student",
          exact: true,
        })
        .click(),
    ]);

    expect(reenrollResponse.status()).toBe(200);

    const reenrollResult = await reenrollResponse.json();

    expect(reenrollResult.data.reactivated).toBe(true);

    expect(reenrollResult.data.enrollment.id).toBe(enrollmentId);

    await expect(cardCount).toContainText(`${initialCount + 1} students`);

    await expect(
      panel
        .locator(".cms-enrollment-table tbody tr")
        .filter({ hasText: studentCode }),
    ).toBeVisible();

    const activeEnrollment = await findEnrollment("ACTIVE");

    expect(activeEnrollment?.id).toBe(enrollmentId);

    // ==========================================================
    // STEP 4: VERIFY STUDENT DETAIL
    // ==========================================================

    await page
      .getByRole("button", {
        name: "Students",
        exact: true,
      })
      .click();

    await page
      .getByRole("searchbox", {
        name: "Search students",
      })
      .fill(studentCode);

    const studentTableRow = page
      .locator(".students-table tbody tr")
      .filter({ hasText: studentCode });

    await expect(studentTableRow).toBeVisible();

    await studentTableRow
      .getByRole("button", {
        name: /View profile of/,
      })
      .click();

    await page
      .getByRole("button", { name: "Enrollments", exact: true })
      .click();
    await expect(page.locator(".student-detail-class-list")).toContainText(
      className,
    );
  } finally {
    // ==========================================================
    // RESTORE ORIGINAL TEST FIXTURE STATUS
    // ==========================================================

    const activeNow = await findEnrollment("ACTIVE");

    if (!originallyActive && activeNow) {
      const cleanupResponse = await request.patch(
        `${API_URL}/enrollments/${activeNow.id}/drop`,
        { headers },
      );

      expect(cleanupResponse.status()).toBe(200);
    }

    if (originallyActive && !activeNow) {
      const restoreResponse = await request.post(`${API_URL}/enrollments`, {
        headers,
        data: {
          studentId,
          classId,
        },
      });

      expect(restoreResponse.status()).toBe(200);
    }
  }
});
