import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCheck,
  ClipboardCheck,
  Download,
  RefreshCw,
  Search,
  UsersRound,
} from "lucide-react";

import { useAuth } from "../../auth/auth-context";
import { getClasses, type ClassRecord } from "../../classes/class-api";
import { apiClient, ApiError } from "../../lib/api-client";
import CompleteSessionButton from "./CompleteSessionButton";

import "./Attendance.css";
import "./AttendancePage.extra.css";

type AttendanceStatus = "PRESENT" | "ABSENT";
type SessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

type ClassSession = {
  id: string;
  classId: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
};

type SessionListResponse = {
  items: ClassSession[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type AttendanceStudent = {
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  fullName: string;
  attendanceStatus: AttendanceStatus | null;
  note: string | null;
  markedAt: string | null;
};

type AttendanceResponse = {
  session: {
    id: string;
    classId: string;
    className: string;
    startsAt: string;
    endsAt: string;
    status: SessionStatus;
  };
  students: AttendanceStudent[];
  summary: { present: number; absent: number; unmarked: number };
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function readableError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session has expired. Sign in again.";
    if (error.status === 403)
      return "You do not have permission to access this class.";
    if (error.status === 409)
      return "The session has changed. Reload its attendance before continuing.";
    return error.message;
  }
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

function csvCell(value: string) {
  // Escape quotes and prevent spreadsheet formulas from executing on open.
  const safe = /^[\s]*[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function exportCsv(data: AttendanceResponse) {
  const lines = [
    ["Session", "Student ID", "Student", "Class", "Status"]
      .map(csvCell)
      .join(","),
    ...data.students.map((student) =>
      [
        data.session.startsAt,
        student.studentCode,
        student.fullName,
        data.session.className,
        student.attendanceStatus ?? "Unmarked",
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  const blob = new Blob(["\ufeff" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `classflow-attendance-${data.session.id}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AttendancePage() {
  const { token, user } = useAuth();

  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [classId, setClassId] = useState("");
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [attendance, setAttendance] = useState<AttendanceResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [query, setQuery] = useState("");

  // Track which requests have settled instead of synchronously resetting
  // loading state inside effects (react-hooks/set-state-in-effect).
  const [classesLoadedFor, setClassesLoadedFor] = useState<string | null>(null);
  const [sessionsLoadedFor, setSessionsLoadedFor] = useState<{
    token: string;
    classId: string;
  } | null>(null);
  const [attendanceLoadedFor, setAttendanceLoadedFor] = useState<{
    token: string;
    sessionId: string;
  } | null>(null);
  const [refreshingAttendance, setRefreshingAttendance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const loadingClasses = Boolean(token && classesLoadedFor !== token);
  const loadingSessions = Boolean(
    token &&
    classId &&
    (sessionsLoadedFor?.token !== token ||
      sessionsLoadedFor.classId !== classId),
  );
  const loadingAttendance = Boolean(
    refreshingAttendance ||
    (token &&
      sessionId &&
      (attendanceLoadedFor?.token !== token ||
        attendanceLoadedFor.sessionId !== sessionId)),
  );

  const pendingRecords = useMemo(() => {
    if (!attendance) return [];
    return attendance.students.flatMap((student) => {
      const status = draft[student.enrollmentId];
      return status && status !== student.attendanceStatus
        ? [{ enrollmentId: student.enrollmentId, status }]
        : [];
    });
  }, [attendance, draft]);

  const hasUnsavedChanges = pendingRecords.length > 0;
  const mayEdit = user?.role === "ADMIN" || user?.role === "TEACHER";
  const isEditable = Boolean(
    mayEdit &&
    attendance?.session.status === "SCHEDULED" &&
    !saving &&
    !loadingAttendance,
  );

  const getStatus = useCallback(
    (student: AttendanceStudent): AttendanceStatus | null =>
      draft[student.enrollmentId] ?? student.attendanceStatus,
    [draft],
  );

  const totals = useMemo(() => {
    const result = { Present: 0, Absent: 0, Unmarked: 0 };
    for (const student of attendance?.students ?? []) {
      const status = getStatus(student);
      if (status === "PRESENT") result.Present++;
      else if (status === "ABSENT") result.Absent++;
      else result.Unmarked++;
    }
    return result;
  }, [attendance, getStatus]);

  const visibleStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (attendance?.students ?? []).filter((student) =>
      `${student.fullName} ${student.studentCode}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [attendance, query]);

  // Warn when closing/reloading the browser with unsaved changes.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);

  // Fetch available classes. Backend remains the source of truth for access permissions.
  useEffect(() => {
    if (!token) return;
    let active = true;
    getClasses(token, { page: 1, limit: 100 })
      .then((result) => {
        if (!active) return;
        setClasses(result.items);
        setClassId((previous) =>
          result.items.some((item) => item.id === previous)
            ? previous
            : (result.items[0]?.id ?? ""),
        );
      })
      .catch((cause: unknown) => {
        if (active) setError(readableError(cause));
      })
      .finally(() => {
        if (active) setClassesLoadedFor(token);
      });
    return () => {
      active = false;
    };
  }, [token]);

  // Load sessions when the class changes or after session completion.
  useEffect(() => {
    if (!token || !classId) return;
    let active = true;
    apiClient<SessionListResponse>(
      `/classes/${encodeURIComponent(classId)}/sessions?page=1&limit=100`,
      { token },
    )
      .then((result) => {
        if (!active) return;
        setSessions(result.items);
        setError("");
        setSessionId((previous) => {
          if (result.items.some((item) => item.id === previous))
            return previous;
          return (
            result.items.find((item) => item.status === "SCHEDULED")?.id ??
            result.items[0]?.id ??
            ""
          );
        });
      })
      .catch((cause: unknown) => {
        if (active) {
          setSessions([]);
          setSessionId("");
          setAttendance(null);
          setDraft({});
          setError(readableError(cause));
        }
      })
      .finally(() => {
        if (active) setSessionsLoadedFor({ token, classId });
      });
    return () => {
      active = false;
    };
  }, [token, classId]);

  useEffect(() => {
    if (!token || !sessionId) return;
    let active = true;
    apiClient<AttendanceResponse>(
      `/sessions/${encodeURIComponent(sessionId)}/attendance`,
      { token },
    )
      .then((data) => {
        if (!active) return;
        setAttendance(data);
        setDraft({});
        setError("");
      })
      .catch((cause: unknown) => {
        if (active) {
          setAttendance(null);
          setError(readableError(cause));
        }
      })
      .finally(() => {
        if (active) setAttendanceLoadedFor({ token, sessionId });
      });
    return () => {
      active = false;
    };
  }, [token, sessionId]);

  const requestRefresh = useCallback(async () => {
    if (!token || !sessionId || !classId) return;

    setRefreshingAttendance(true);
    setError("");
    try {
      const [latest, sessionList] = await Promise.all([
        apiClient<AttendanceResponse>(
          `/sessions/${encodeURIComponent(sessionId)}/attendance`,
          { token },
        ),
        apiClient<SessionListResponse>(
          `/classes/${encodeURIComponent(classId)}/sessions?page=1&limit=100`,
          { token },
        ),
      ]);
      setAttendance(latest);
      setSessions(sessionList.items);
      setDraft({});
    } catch (cause) {
      setError(readableError(cause));
      throw cause;
    } finally {
      setRefreshingAttendance(false);
    }
  }, [token, sessionId, classId]);

  function confirmDiscard() {
    return (
      !hasUnsavedChanges ||
      window.confirm("You have unsaved attendance changes. Discard them?")
    );
  }

  function changeClass(nextId: string) {
    if (nextId === classId || !confirmDiscard()) return;
    setClassId(nextId);
    setSessions([]);
    setSessionId("");
    setAttendance(null);
    setDraft({});
    setQuery("");
    setFeedback("");
    setError("");
  }

  function changeSession(nextId: string) {
    if (nextId === sessionId || !confirmDiscard()) return;
    setSessionId(nextId);
    setAttendance(null);
    setDraft({});
    setQuery("");
    setFeedback("");
    setError("");
  }

  function mark(studentId: string, status: AttendanceStatus) {
    if (!isEditable) return;
    setDraft((previous) => ({ ...previous, [studentId]: status }));
    setFeedback("");
    setError("");
  }

  function markAllPresent() {
    if (!attendance || !isEditable) return;
    setDraft((previous) => {
      const next = { ...previous };
      for (const student of attendance.students) {
        next[student.enrollmentId] = "PRESENT";
      }
      return next;
    });
    setFeedback("");
    setError("");
  }

  async function save() {
    if (!token || !sessionId || !isEditable || !pendingRecords.length) return;
    setSaving(true);
    setError("");
    setFeedback("");
    try {
      await apiClient(`/sessions/${encodeURIComponent(sessionId)}/attendance`, {
        token,
        method: "PUT",
        body: JSON.stringify({ records: pendingRecords }),
      });
      const latest = await apiClient<AttendanceResponse>(
        `/sessions/${encodeURIComponent(sessionId)}/attendance`,
        { token },
      );
      setAttendance(latest);
      setDraft({});
      setFeedback("Attendance saved successfully.");
    } catch (cause) {
      setError(readableError(cause));
      if (cause instanceof ApiError && [401, 403, 409].includes(cause.status)) {
        // Keep drafts so the user can review them before explicitly reloading.
        setFeedback(
          "The server rejected the update. Review the latest session data.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function completeSession(id: string) {
    if (!token) throw new Error("Authentication is required.");
    await apiClient(`/sessions/${encodeURIComponent(id)}/complete`, {
      method: "PATCH",
      token,
    });
  }

  return (
    <div className="attendance-page">
      <header className="attendance-header">
        <div>
          <span className="attendance-eyebrow">
            <span className="attendance-pulse" /> CLASSROOM OVERVIEW
          </span>
          <h2>
            Daily attendance<span className="attendance-accent">.</span>
          </h2>
          <p>Manage attendance for each class session.</p>
        </div>
        <div className="attendance-header-actions">
          <button
            className="attendance-button"
            type="button"
            disabled={!attendance || loadingAttendance}
            onClick={() => attendance && exportCsv(attendance)}
          >
            <Download size={16} /> Export CSV
          </button>
          <button
            className="attendance-button attendance-primary"
            type="button"
            disabled={!isEditable || pendingRecords.length === 0}
            onClick={() => void save()}
          >
            <Check size={17} />{" "}
            {saving
              ? "Saving..."
              : `Save attendance${pendingRecords.length ? ` (${pendingRecords.length})` : ""}`}
          </button>
        </div>
      </header>

      <div className="attendance-stats">
        {(
          [
            {
              title: "Present",
              color: "green",
              icon: CheckCheck,
              value: totals.Present,
            },
            {
              title: "Absent",
              color: "red",
              icon: UsersRound,
              value: totals.Absent,
            },
            {
              title: "Unmarked",
              color: "orange",
              icon: ClipboardCheck,
              value: totals.Unmarked,
            },
          ] as const
        ).map((item) => (
          <div
            className={`attendance-stat attendance-stat-${item.color}`}
            key={item.title}
          >
            <div className="attendance-stat-top">
              <span>
                <i /> {item.title}
              </span>
              <item.icon size={19} />
            </div>
            <strong>
              {item.value}
              <small> students</small>
            </strong>
            <p>
              {attendance?.students.length
                ? Math.round((item.value / attendance.students.length) * 100)
                : 0}
              % of selected students
            </p>
          </div>
        ))}
      </div>

      <section className="attendance-panel">
        <div className="attendance-panel-top">
          <div>
            <h3>Attendance register</h3>
            <p>Choose a class and session to review or mark attendance.</p>
          </div>
          <span className="attendance-count">
            {attendance?.students.length ?? 0} students
          </span>
        </div>

        <div className="attendance-filters">
          <label className="attendance-select-label">
            <span className="attendance-sr-only">Choose class</span>
            <select
              aria-label="Choose class"
              value={classId}
              disabled={loadingClasses || saving}
              onChange={(event) => changeClass(event.target.value)}
            >
              {classes.length === 0 && (
                <option value="">No classes available</option>
              )}
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="attendance-select-label">
            <span className="attendance-sr-only">Choose session</span>
            <select
              aria-label="Choose session"
              value={sessionId}
              disabled={!classId || loadingSessions || saving}
              onChange={(event) => changeSession(event.target.value)}
            >
              {sessions.length === 0 && (
                <option value="">No sessions available</option>
              )}
              {sessions.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatDateTime(item.startsAt)} · {item.status}
                </option>
              ))}
            </select>
          </label>

          <label className="attendance-search">
            <Search size={17} />
            <input
              aria-label="Search students"
              placeholder="Search students..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <button
            className="attendance-button attendance-mark-all"
            type="button"
            disabled={!attendance || !attendance.students.length || !isEditable}
            onClick={markAllPresent}
          >
            <CheckCheck size={16} /> Mark all present
          </button>
        </div>

        <div className="attendance-summary">
          <span>
            <ClipboardCheck size={15} />{" "}
            {attendance
              ? `${attendance.students.length - totals.Unmarked}/${attendance.students.length} marked`
              : "No session selected"}
          </span>
          <span>
            {hasUnsavedChanges
              ? `${pendingRecords.length} unsaved change(s)`
              : attendance?.session.status === "COMPLETED"
                ? "Completed · Read-only"
                : attendance?.session.status === "CANCELLED"
                  ? "Cancelled · Read-only"
                  : "Up to date"}
          </span>
        </div>

        {error && (
          <p
            className="attendance-feedback attendance-feedback-error"
            role="alert"
          >
            {error}
          </p>
        )}
        {feedback && (
          <p className="attendance-feedback" role="status">
            {feedback}
          </p>
        )}

        <div className="attendance-table-scroll">
          <table className="attendance-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Student ID</th>
                <th>Class</th>
                <th>Attendance status</th>
              </tr>
            </thead>
            <tbody>
              {(loadingClasses || loadingSessions || loadingAttendance) && (
                <tr>
                  <td colSpan={4} className="attendance-empty">
                    Loading attendance...
                  </td>
                </tr>
              )}
              {!loadingClasses &&
                !loadingSessions &&
                !loadingAttendance &&
                visibleStudents.map((student) => (
                  <tr key={student.enrollmentId}>
                    <td>
                      <div className="attendance-student">
                        <span className="attendance-avatar">
                          {initials(student.fullName)}
                        </span>
                        <div>
                          <strong>{student.fullName}</strong>
                          <small>{student.studentCode}</small>
                        </div>
                      </div>
                    </td>
                    <td className="attendance-muted">{student.studentCode}</td>
                    <td>
                      <span className="attendance-class-tag">
                        {attendance?.session.className}
                      </span>
                    </td>
                    <td>
                      <div
                        className="attendance-segments"
                        role="group"
                        aria-label={`Attendance for ${student.fullName}`}
                      >
                        {(["PRESENT", "ABSENT"] as const).map((status) => (
                          <button
                            type="button"
                            key={status}
                            aria-pressed={getStatus(student) === status}
                            disabled={!isEditable}
                            className={
                              getStatus(student) === status
                                ? `is-active is-${status.toLowerCase()}`
                                : ""
                            }
                            onClick={() => mark(student.enrollmentId, status)}
                          >
                            {getStatus(student) === status && (
                              <Check size={13} />
                            )}
                            {status === "PRESENT" ? "Present" : "Absent"}
                          </button>
                        ))}
                        {getStatus(student) === null && (
                          <span className="attendance-unmarked">Unmarked</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              {!loadingClasses &&
                !loadingSessions &&
                !loadingAttendance &&
                visibleStudents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="attendance-empty">
                      {!classId
                        ? "No classes available."
                        : !sessionId
                          ? "No sessions available for this class."
                          : "No students match this session or search."}
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>

        {/* Complete Session must be outside the horizontal-scroll table container. */}
        {attendance && !loadingAttendance && (
          <div className="attendance-complete-row">
            <CompleteSessionButton
              key={attendance.session.id}
              sessionId={attendance.session.id}
              status={attendance.session.status}
              students={attendance.students}
              canComplete={Boolean(mayEdit)}
              hasUnsavedChanges={hasUnsavedChanges || saving}
              onComplete={() => completeSession(attendance.session.id)}
              onRefresh={requestRefresh}
            />
          </div>
        )}

        <footer className="attendance-footer">
          <span>
            {attendance
              ? `Session: ${formatDateTime(attendance.session.startsAt)} · ${attendance.session.status}`
              : "Live attendance from ClassFlow"}
          </span>
          <span>{visibleStudents.length} visible students</span>
          <button
            className="attendance-button attendance-refresh-button"
            type="button"
            disabled={
              !sessionId || loadingAttendance || saving || hasUnsavedChanges
            }
            onClick={() => void requestRefresh()}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </footer>
      </section>
    </div>
  );
}
