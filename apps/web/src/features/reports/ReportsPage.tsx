import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Download,
  RefreshCw,
  Wallet,
} from "lucide-react";

import { useAuth } from "../../auth/auth-context";
import { getClasses, type ClassRecord } from "../../classes/class-api";
import { ApiError } from "../../lib/api-client";
import {
  getMonthlyAttendance,
  getMonthlyTuition,
  setClassTuitionRate,
  type MonthlyAttendanceReport,
  type MonthlyTuitionReport,
} from "./reports.api";
import "./ReportsPage.css";

type ReportTab = "attendance" | "tuition";
type Report = MonthlyAttendanceReport | MonthlyTuitionReport;

function isTuitionReport(report: Report): report is MonthlyTuitionReport {
  return "pricing" in report;
}

type RequestState = {
  key: string;
  data: Report | null;
  error: string;
};

function vietnamMonth(): string {
  const dateParts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).formatToParts(new Date());
  const year = dateParts.find((part) => part.type === "year")?.value;
  const month = dateParts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return "Your session has expired. Please sign in again.";
    if (error.status === 403)
      return "You do not have permission to access this report.";
    if (error.status === 404) return "The selected class is unavailable.";
    if (error.status === 0)
      return "Cannot connect to the server. Please try again.";
    return error.message || "Request failed.";
  }
  return "Unable to load report. Please try again.";
}

const vnd = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
function currency(value: number | null): string {
  return value === null ? "Not available" : vnd.format(value);
}
function percentage(value: number | null): string {
  return value === null ? "N/A" : `${value.toFixed(1)}%`;
}

/** Avoid CSV injection from stored student names and codes. */
function csv(value: string | number): string {
  let cell = String(value);
  if (/^\s*[=+@-]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replace(/"/g, '""')}"`;
}

function exportReport(report: Report, tab: ReportTab) {
  const tuition = tab === "tuition" && isTuitionReport(report);
  const headings = [
    "Month",
    "Student ID",
    "Student",
    "Enrollment",
    "Eligible sessions",
    "Present",
    "Absent",
    "Unmarked",
    "Attendance rate (%)",
  ];
  if (tuition)
    headings.push(
      "Rate (VND/session)",
      "Billable sessions",
      "Estimated tuition (VND)",
    );
  const lines = [headings.map(csv).join(",")];
  for (const row of report.students) {
    const cells: Array<string | number> = [
      report.month,
      row.studentCode,
      row.fullName,
      row.enrollmentStatus,
      row.eligibleSessions,
      row.present,
      row.absent,
      row.unmarked,
      row.attendanceRate ?? "N/A",
    ];
    if (tuition) {
      const billed = row as MonthlyTuitionReport["students"][number];
      cells.push(
        report.pricing.amountPerSessionVnd ?? "Not configured",
        billed.billableSessions,
        billed.amountVnd ?? "Not available",
      );
    }
    lines.push(cells.map(csv).join(","));
  }
  const blob = new Blob(["\ufeff", lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `classflow-${tab}-${report.month}-${report.class.id}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ReportsPage() {
  const { token, user } = useAuth();
  const [month, setMonth] = useState(vietnamMonth);
  const [classId, setClassId] = useState("");
  const [tab, setTab] = useState<ReportTab>("attendance");
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [classLoad, setClassLoad] = useState<{ done: boolean; error: string }>({
    done: false,
    error: "",
  });
  const [classesRetry, setClassesRetry] = useState(0);
  const [reportState, setReportState] = useState<RequestState | null>(null);
  const [revision, setRevision] = useState(0);
  const [amountInput, setAmountInput] = useState("");
  const [savingRate, setSavingRate] = useState(false);
  const [rateNotice, setRateNotice] = useState("");
  const [rateError, setRateError] = useState("");
  const key = `${tab}:${classId}:${month}:${revision}`;
  const validMonth =
    /^\d{4}-(0[1-9]|1[0-2])$/.test(month) &&
    Number(month.slice(0, 4)) >= 1000 &&
    Number(month.slice(0, 4)) <= 9998;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function loadClasses() {
      try {
        const items: ClassRecord[] = [];
        let page = 1;
        // All accessible classes, not just the first page.
        for (; page <= 100; page++) {
          const data = await getClasses(token!, { page, limit: 100 });
          items.push(...data.items);
          if (page >= data.pagination.totalPages) break;
        }
        if (page > 100) throw new Error("Too many class pages.");
        if (!cancelled) {
          setClasses(items);
          setClassId((current) =>
            items.some((item) => item.id === current)
              ? current
              : (items[0]?.id ?? ""),
          );
          setClassLoad({ done: true, error: "" });
        }
      } catch (error) {
        if (!cancelled)
          setClassLoad({ done: true, error: errorMessage(error) });
      }
    }
    void loadClasses();
    return () => {
      cancelled = true;
    };
  }, [token, classesRetry]);

  useEffect(() => {
    if (!token || !classId || !validMonth) return;
    let cancelled = false;
    const request =
      tab === "attendance"
        ? getMonthlyAttendance(token, classId, month)
        : getMonthlyTuition(token, classId, month);
    request
      .then((data) => {
        if (cancelled) return;
        setReportState({ key, data, error: "" });
        if (isTuitionReport(data))
          setAmountInput(data.pricing.amountPerSessionVnd?.toString() ?? "");
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setReportState({ key, data: null, error: errorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [token, classId, month, tab, revision, key, validMonth]);

  const active = reportState?.key === key ? reportState : null;
  const loading = !!token && !!classId && validMonth && active === null;
  const report = active?.data ?? null;
  const tuition = report && isTuitionReport(report) ? report : null;
  const currentClass = classes.find((item) => item.id === classId);
  const admin = user?.role === "ADMIN";
  const cleanAmount = amountInput.trim();
  const amount = cleanAmount === "" ? NaN : Number(cleanAmount);
  const amountValid =
    cleanAmount !== "" &&
    /^\d+$/.test(cleanAmount) &&
    Number.isSafeInteger(amount) &&
    amount >= 0 &&
    amount <= 100_000_000;

  async function saveRate() {
    if (!token || !admin || !tuition || !amountValid || savingRate) return;
    if (tuition.pricing.amountPerSessionVnd !== null) {
      const confirmed = window.confirm(
        `Save a tuition rate effective ${month}? This revises estimates from ${month} until the next configured rate. Earlier effective-month rates are kept.`,
      );
      if (!confirmed) return;
    }
    setSavingRate(true);
    setRateError("");
    setRateNotice("");
    try {
      await setClassTuitionRate(token, classId, month, amount);
      setRateNotice(`Rate saved for ${month}. Reports are being refreshed.`);
      setRevision((value) => value + 1);
    } catch (error) {
      setRateError(errorMessage(error));
    } finally {
      setSavingRate(false);
    }
  }

  return (
    <div className="monthly-page">
      <header className="monthly-heading">
        <div className="monthly-heading-icon">
          <BarChart3 size={25} aria-hidden="true" />
        </div>
        <div>
          <h2>
            Monthly reports<span className="monthly-accent">.</span>
          </h2>
          <p>
            Class attendance and tuition estimates, based on completed sessions.
          </p>
        </div>
      </header>

      <section
        className="monthly-card monthly-filters"
        aria-label="Report filters"
      >
        <label>
          <span>Class</span>
          <select
            aria-label="Report class"
            value={classId}
            disabled={!classLoad.done || savingRate}
            onChange={(event) => {
              setClassId(event.target.value);
              setRateNotice("");
              setRateError("");
            }}
          >
            {classes.length === 0 && (
              <option value="">No classes available</option>
            )}
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.teacher.user.fullName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Month (Vietnam time)</span>
          <span className="monthly-month-field">
            <CalendarDays size={16} aria-hidden="true" />
            <input
              aria-label="Report month"
              type="month"
              min="1000-01"
              max="9998-12"
              value={month}
              disabled={savingRate}
              onChange={(event) => {
                setMonth(event.target.value);
                setRateNotice("");
                setRateError("");
              }}
            />
          </span>
        </label>
        <button
          type="button"
          className="monthly-refresh"
          onClick={() => setRevision((value) => value + 1)}
          disabled={!classId || loading || savingRate}
        >
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </section>

      <div className="monthly-tabs" role="tablist" aria-label="Report type">
        <button
          role="tab"
          type="button"
          aria-selected={tab === "attendance"}
          className={tab === "attendance" ? "is-active" : ""}
          onClick={() => {
            setTab("attendance");
            setRateError("");
          }}
        >
          <BarChart3 size={16} aria-hidden="true" /> Attendance statistics
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={tab === "tuition"}
          className={tab === "tuition" ? "is-active" : ""}
          onClick={() => {
            setTab("tuition");
            setRateError("");
          }}
        >
          <Wallet size={16} aria-hidden="true" /> Tuition estimates
        </button>
      </div>

      {!classLoad.done && (
        <p className="monthly-message" role="status">
          Loading classes…
        </p>
      )}
      {classLoad.error && (
        <div className="monthly-message monthly-error" role="alert">
          {classLoad.error}{" "}
          <button onClick={() => setClassesRetry((value) => value + 1)}>
            Retry
          </button>
        </div>
      )}
      {classLoad.done && !classLoad.error && !classId && (
        <p className="monthly-message" role="status">
          No classes are available for reporting.
        </p>
      )}
      {!validMonth && (
        <p className="monthly-message monthly-error" role="alert">
          Select a valid month.
        </p>
      )}
      {loading && (
        <p className="monthly-message" role="status">
          Loading monthly report…
        </p>
      )}
      {active?.error && (
        <div className="monthly-message monthly-error" role="alert">
          {active.error}{" "}
          <button onClick={() => setRevision((value) => value + 1)}>
            Retry report
          </button>
        </div>
      )}

      {report && (
        <div
          className="monthly-content"
          role="region"
          aria-label="Monthly report"
        >
          <div className="monthly-report-top">
            <div>
              <p className="monthly-eyebrow">
                {currentClass?.name ?? report.class.name} · {month}
              </p>
              <h3>
                {tab === "attendance"
                  ? "Attendance overview"
                  : "Tuition estimate"}
              </h3>
            </div>
            <button
              className="monthly-export"
              type="button"
              onClick={() => exportReport(report, tab)}
            >
              <Download size={16} aria-hidden="true" /> Export CSV
            </button>
          </div>
          <div className="monthly-metrics">
            <Metric
              label="Completed sessions"
              value={report.sessions.completed.toString()}
              tone="violet"
            />
            <Metric
              label="Present records"
              value={report.totals.present.toString()}
              tone="green"
            />
            <Metric
              label="Absent records"
              value={report.totals.absent.toString()}
              tone="red"
            />
            <Metric
              label={tuition ? "Estimated tuition" : "Attendance rate"}
              value={
                tuition
                  ? currency(tuition.totals.amountVnd)
                  : percentage(report.totals.attendanceRate)
              }
              tone="blue"
            />
          </div>
          <div className="monthly-detail-line">
            <span>{report.totals.students} students</span>
            <span>
              {report.totals.eligibleSessions} eligible student-sessions
            </span>
            <span>{report.totals.unmarked} unmarked</span>
            <span>
              {report.sessions.scheduled} scheduled ·{" "}
              {report.sessions.cancelled} cancelled (excluded)
            </span>
          </div>

          {tuition && (
            <section
              className="monthly-card monthly-pricing"
              aria-label="Tuition configuration"
            >
              <div>
                <h4>Tuition per attended session</h4>
                <p>
                  Only Present is billable. Absent and Unmarked are not charged.
                  Reports are estimates, not invoices or payment records.
                </p>
                <p>
                  Effective from:{" "}
                  {tuition.pricing.effectiveMonth ?? "Not configured"}
                </p>
                <p>Rates apply from the selected month until the next configured rate. Editing a rate revises estimates for that period.</p>
                {tuition.pricing.warning && (
                  <p className="monthly-warning" role="alert">
                    {tuition.pricing.warning}
                  </p>
                )}
              </div>
              {admin ? (
                <div className="monthly-pricing-form">
                  <label>
                    Rate (VND)
                    <input
                      aria-label="Tuition rate (VND)"
                      type="number"
                      min="0"
                      max="100000000"
                      step="1"
                      value={amountInput}
                      disabled={savingRate}
                      onChange={(event) => setAmountInput(event.target.value)}
                      placeholder="e.g. 120000"
                    />
                  </label>
                  <button
                    className="monthly-primary"
                    type="button"
                    onClick={() => void saveRate()}
                    disabled={!amountValid || savingRate || loading}
                  >
                    {savingRate ? "Saving…" : `Save rate from ${month}`}
                  </button>
                </div>
              ) : (
                <strong className="monthly-rate-readonly">
                  {currency(tuition.pricing.amountPerSessionVnd)} / session
                </strong>
              )}
              {rateError && (
                <p className="monthly-error" role="alert">
                  {rateError}
                </p>
              )}
              {rateNotice && (
                <p className="monthly-success" role="status">
                  {rateNotice}
                </p>
              )}
            </section>
          )}

          <section
            className="monthly-card monthly-student-table"
            aria-label="Monthly student breakdown"
          >
            <div className="monthly-table-heading">
              <h4>Student breakdown</h4>
              <span>{report.students.length} students</span>
            </div>
            {report.students.length === 0 ? (
              <p className="monthly-empty">
                No enrollment activity overlaps this month.
              </p>
            ) : (
              <div
                className="monthly-table-scroll"
                role="region"
                aria-label="Scrollable monthly student table"
                tabIndex={0}
              >
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Student</th>
                      <th scope="col">Enrollment</th>
                      <th scope="col">Eligible</th>
                      <th scope="col">Present</th>
                      <th scope="col">Absent</th>
                      <th scope="col">Unmarked</th>
                      <th scope="col">Attendance rate</th>
                      {tuition && <th scope="col">Estimated tuition</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {report.students.map((row) => (
                      <tr key={row.enrollmentId}>
                        <th scope="row">
                          <strong>{row.fullName}</strong>
                          <small>{row.studentCode}</small>
                        </th>
                        <td>
                          <span
                            className={`monthly-status monthly-status-${row.enrollmentStatus.toLowerCase()}`}
                          >
                            {row.enrollmentStatus}
                          </span>
                        </td>
                        <td>{row.eligibleSessions}</td>
                        <td>{row.present}</td>
                        <td>{row.absent}</td>
                        <td>{row.unmarked}</td>
                        <td>{percentage(row.attendanceRate)}</td>
                        {tuition && (
                          <td className="monthly-money">
                            {currency(
                              (row as MonthlyTuitionReport["students"][number])
                                .amountVnd,
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <p className="monthly-footnote">
            Reporting timezone: Asia/Ho_Chi_Minh. Only completed sessions are
            counted. Enrollment eligibility uses historical participation
            periods.
          </p>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "violet" | "green" | "red" | "blue";
}) {
  return (
    <div className={`monthly-metric monthly-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
