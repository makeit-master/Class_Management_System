# ClassFlow Figma synchronization audit

Reviewed 4 November 2026. The supplied ClassFlow School Admin Dashboard.zip contains the original Figma Make React and CSS source. Its rendered pages and theme definitions were used for comparison. Archive instructions were treated as reference content.

## Page comparison

| Page | Initial difference | Applied changes and remaining differences |
| --- | --- | --- |
| Shared shell | Header proportions, generic subtitles, colors and permanent mobile icon rail differed | Exported palette, breadcrumb, page subtitles, violet navigation and mobile modal drawer. Authenticated user identity retained. Generic school workspace label because no school API supplies the shell. Search navigates authorized pages. |
| Dashboard | Final exported desktop spacing rules missing | Exported card heights, spacing and shared gutter. Existing sample data retained. |
| Classes | Independent palette and oversized heading | Shared toolbar, tokens, card corners and violet buttons. Live records, archive tabs and enrollment workflows differ from reference sample cards. |
| Students | Blue-gray panels and separate typography | Shared heading, neutral surfaces, tables and form tokens. Existing live columns retained. Reference attendance/grade columns require data absent from the student API. |
| Student detail | Different production information sections | Profile styling, Overview/Enrollments/Notes sections and Student Detail header. Live guardian, notes and enrollment data retained. Reference learning charts require unavailable API data. |
| Teachers | Independent palette, extra eyebrow and larger heading | Shared toolbar, neutral cards and violet controls. Existing filters and profile/create/edit/delete dialogs retained. Records remain client-side demo state. |
| Attendance | Route opens real sessions rather than the exported mock daily table | Shared panels, summary cards, roster and Save styling. Complete Session is now reachable on the selected roster. Session picker retained for session-scoped records. Only PRESENT and ABSENT are stored. Unmarked means no record. |
| Grades | Additional summary cards, duplicate gutter and different distribution colors | Shared toolbar, removed top summary cards and duplicate gutter, violet distribution. Counts retained in footer. Editable scores and CSV export retained. Data remains client-side demo state. |
| Schedule | Decorative panels, nested gutter, different calendar and broken theme selectors | Date-led toolbar, Day/Week time grid, removed decorative panels, centralized theme. Month, filters and lesson dialogs retained. Events use hourly buckets. Data remains client-side demo state. |
| Settings | Duplicate heading and blue-gray forms | Shared surfaces, removed duplicate heading, profile avatar and inherited theme. Existing page-local save behavior retained. |
| Login | Already close, independent tokens and corners | Shared palette, Inter weights, reference favicon and card radius. Existing JWT flow retained. |
| Create/edit/details and enrollment dialogs | Separate palette and control treatments | Existing forms inherit shared surface, border, text and accent tokens. Production-only fields and confirmations retain their existing content. |

The principal differences were reported in chat before major edits. The source export was rendered for Dashboard, Classes, Students, Student Detail, Teachers, Attendance, Grades, Schedule, Settings and Login. Desktop screenshot montages were inspected. This work does not establish pixel-identical equivalence for production-only data and workflows.

## Design system

- Inter weights include intermediate weights used by the export.
- Exported Dark and Light tokens replace module-specific palettes.
- Shared tokens cover surfaces, borders, text, accent/status tones, primary gradient and card radius.
- PageToolbar is reused by directory, grades and schedule pages.
- Mobile navigation uses a native modal dialog and reduced-motion preferences are respected.

## Actual validation

| Check | Result | Scope |
| --- | --- | --- |
| Baseline lint/build | PASS | Both passed before edits. |
| Final ESLint | PASS | npm run lint |
| TypeScript | PASS | tsc -b apps/web/tsconfig.json and production build |
| Production build | PASS | npm run build |
| Existing isolated Playwright tests | PASS | 12 existing session/attendance tests |
| Complete Session regression | PASS | New test covers unmarked/unsaved disabling, cancel, authenticated PATCH and read-only refresh |
| Combined Playwright suite | PASS | 13 tests, e2e/session-list.config.ts, mocked API responses |
| Responsive/theme sweep | PASS | All mounted pages and Login at 1440, 820, 390 and 320 pixels, both themes. Checked document overflow, effective color scheme and runtime errors. |
| Details/dialog sweep | PASS | Same widths/themes. Class details/create/edit/enroll, student profile/create/edit/tabs, teacher profile/create/edit, lesson create/details, Day/Month views and settings tabs. Dialog geometry stayed within the viewport. |
| Reference visual inspection | PASS | Qualitative desktop screenshot comparison. Automated pixel comparison was not performed. |
| Frontend unit tests | SKIP | No frontend unit-test script or separate unit suite configured. |
| Database enrollment E2E | SKIP | Isolated database flags and credentials unavailable. |
| Database attendance regression | SKIP | E2E_DB_ISOLATED and E2E_ALLOW_DB_WRITES were unavailable. |
| Dormant AttendancePage | SKIP | Unmounted legacy component imports a pre-existing missing AttendancePage.extra.css. Supported route uses SessionListPage and SessionAttendanceTable. |
| Git whitespace check | PASS | git diff --check |

The first mobile sweep found 320-pixel header overflow. It was fixed and the final sweep passed. A fresh preview server resolved stale development modules encountered during edits.

## Limitations

Production-only session/enrollment screens have no exact exported frame. Their styling follows the exported components. Student detail statistics absent from the API were not fabricated. The dormant legacy AttendancePage has not been restored or browser-validated. Real database writes, end-to-end JWT server behavior and enrollment lifecycle were not exercised by the mocked suite. No backend, API client or database status definitions were edited.

## Recommended commits

1. style(web) align tokens, shell and login with Figma
2. style(web) synchronize feature pages and reusable toolbar
3. fix(web) expose completion in the selected attendance roster, with regression test
4. docs record UI comparison and validation

No commits or pushes were made. The changed-file inventory follows.

## Changed files

- apps/web/index.html
- apps/web/public/favicon.svg
- apps/web/src/App.css
- apps/web/src/components/layout/AppLayout.tsx
- apps/web/src/components/layout/Header.css
- apps/web/src/components/layout/Header.tsx
- apps/web/src/components/layout/Sidebar.css
- apps/web/src/components/layout/Sidebar.tsx
- apps/web/src/components/ui/PageToolbar.tsx
- apps/web/src/features/attendance/CompleteSessionButton.css
- apps/web/src/features/attendance/SessionAttendanceTable.tsx
- apps/web/src/features/attendance/SessionList.css
- apps/web/src/features/attendance/SessionListPage.tsx
- apps/web/src/features/classes/Classes.css
- apps/web/src/features/classes/ClassesPage.tsx
- apps/web/src/features/dashboard/Dashboard.css
- apps/web/src/features/enrollments/ClassEnrollmentList.css
- apps/web/src/features/enrollments/DropStudentModal.css
- apps/web/src/features/enrollments/EnrollmentStudentModal.css
- apps/web/src/features/grades/Grades.css
- apps/web/src/features/grades/GradesPage.tsx
- apps/web/src/features/schedule/Schedule.css
- apps/web/src/features/schedule/SchedulePage.tsx
- apps/web/src/features/settings/Settings.css
- apps/web/src/features/settings/SettingsPage.tsx
- apps/web/src/features/students/Students.css
- apps/web/src/features/students/StudentsPage.tsx
- apps/web/src/features/teachers/Teachers.css
- apps/web/src/features/teachers/TeachersPage.tsx
- apps/web/src/index.css
- apps/web/src/pages/LoginPage.css
- e2e/session-list.spec.ts
- UI_AUDIT.md
