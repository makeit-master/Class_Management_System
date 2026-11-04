import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../lib/api-client";
import { useAuth } from "../../auth/auth-context";
import { can } from "../../auth/permissions";
import { useAttendanceNavigationGuard } from "../../lib/unsaved-changes";
import {
  getSessionAttendance,
  updateSessionAttendance,
} from "./attendance.api";
import type {
  AttendanceStatus,
  SessionAttendanceData,
} from "./attendance.types";

function attendanceError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return "Your session has expired. Please log in again.";
    if (error.status === 403)
      return "You do not have permission to view this session's attendance.";
    if (error.status === 404)
      return "This session was not found or its class has been archived.";
    if (error.status === 0)
      return "Cannot connect to the server. Please try again.";
  }
  return "Unable to load attendance. Please try again.";
}

export default function SessionAttendanceTable({
  token,
  sessionId,
}: {
  token: string;
  sessionId: string;
}) {
  const [data, setData] = useState<SessionAttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const { user } = useAuth();
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [blocked, setBlocked] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const records =
    data?.students.flatMap((student) => {
      const status = draft[student.enrollmentId];
      return status && status !== student.attendanceStatus
        ? [{ enrollmentId: student.enrollmentId, status }]
        : [];
    }) ?? [];
  const summary = { present: 0, absent: 0, unmarked: 0 };
  for (const student of data?.students ?? []) {
    const status = draft[student.enrollmentId] ?? student.attendanceStatus;
    if (status === "PRESENT") summary.present++;
    else if (status === "ABSENT") summary.absent++;
    else summary.unmarked++;
  }
  const editable =
    can(user, "attendance:edit") &&
    data?.session.status === "SCHEDULED" &&
    !blocked;
  useAttendanceNavigationGuard(records.length > 0, saving);

  async function save() {
    if (
      !editable ||
      inFlight.current ||
      !records.length ||
      records.length > 200
    )
      return;
    inFlight.current = true;
    setSaving(true);
    setSaveError("");
    setNotice("");
    let saved = false;
    try {
      await updateSessionAttendance(token, sessionId, { records });
      saved = true;
      const fresh = await getSessionAttendance(token, sessionId);
      if (!mounted.current) return;
      setData(fresh);
      setDraft({});
      setNotice("Attendance saved successfully.");
    } catch (err) {
      if (!mounted.current) return;
      if (saved) {
        // Never offer to resend a write that already succeeded.
        setDraft({});
        setBlocked(true);
        setSaveError(
          "Attendance was saved, but the updated register could not be loaded. Reload attendance before editing again.",
        );
      } else if (err instanceof ApiError && err.status === 409) {
        setBlocked(true);
        setSaveError(
          "Attendance could not be saved because the session changed. Reload attendance to review the latest data. Your changes have not been saved.",
        );
      } else if (
        err instanceof ApiError &&
        (err.status === 401 || err.status === 403)
      ) {
        setBlocked(true);
        setSaveError(
          err.status === 401
            ? "Your session has expired. Please log in again."
            : "You no longer have permission to edit this attendance. Your changes have not been saved.",
        );
      } else {
        setSaveError(
          "Unable to save attendance. Your changes are still here. Please try again.",
        );
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  function reload() {
    if (
      records.length &&
      !window.confirm("Discard unsaved attendance changes and reload?")
    )
      return;
    setDraft({});
    setSaveError("");
    setNotice("");
    setBlocked(false);
    setRetry((value) => value + 1);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setData(null);
      setError("");
      try {
        const result = await getSessionAttendance(token, sessionId);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(attendanceError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, sessionId, retry]);

  return (
    <section aria-label="Session attendance" aria-busy={loading || saving}>
      <h4>Attendance register</h4>
      {loading && <p role="status">Loading attendance…</p>}
      {!loading && error && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Retry attendance
          </button>
        </div>
      )}
      {!loading && !error && data && (
        <>
          <dl className="session-details">
            <div>
              <dt>Class</dt>
              <dd>{data.session.className}</dd>
            </div>
            <div>
              <dt>Starts</dt>
              <dd>{new Date(data.session.startsAt).toLocaleString("en-US")}</dd>
            </div>
            <div>
              <dt>Ends</dt>
              <dd>{new Date(data.session.endsAt).toLocaleString("en-US")}</dd>
            </div>
            <div>
              <dt>Session status</dt>
              <dd>{data.session.status}</dd>
            </div>
          </dl>
          <p>
            {data.session.status === "COMPLETED"
              ? "This session is completed. Attendance is read-only."
              : data.session.status === "CANCELLED"
                ? "This session is cancelled. Attendance is read-only."
                : !can(user, "attendance:edit")
                  ? "You do not have permission to edit attendance."
                  : "Choose Present or Absent for each student, then save your changes."}
          </p>
          <div className="session-save-toolbar">
            <p role="status">
              {saving
                ? "Saving attendance…"
                : records.length
                  ? `${records.length} unsaved change${records.length === 1 ? "" : "s"}`
                  : notice || "No unsaved changes."}
            </p>
            {editable && data.students.length > 0 && (
              <button
                type="button"
                disabled={saving || !records.length || records.length > 200}
                onClick={() => void save()}
              >
                Save attendance
              </button>
            )}
            {records.length > 0 && !saving && !blocked && (
              <button type="button" onClick={reload}>
                Discard changes and reload
              </button>
            )}
            {blocked && (
              <button type="button" disabled={saving} onClick={reload}>
                Reload attendance
              </button>
            )}
          </div>
          {records.length > 200 && (
            <p role="alert">
              Save up to 200 changed students at a time. Revert some changes
              before saving.
            </p>
          )}
          {saveError && <p role="alert">{saveError}</p>}
          <dl
            className="session-attendance-summary"
            aria-label="Attendance summary"
          >
            <div>
              <dt>Students</dt>
              <dd>{data.students.length}</dd>
            </div>
            <div>
              <dt>Present</dt>
              <dd>{summary.present}</dd>
            </div>
            <div>
              <dt>Absent</dt>
              <dd>{summary.absent}</dd>
            </div>
            <div>
              <dt>Unmarked</dt>
              <dd>{summary.unmarked}</dd>
            </div>
          </dl>
          {data.students.length === 0 ? (
            <p role="status">No students are eligible for this session.</p>
          ) : (
            <div
              className="session-table-scroll"
              role="region"
              aria-label="Attendance table"
              tabIndex={0}
            >
              <table>
                <caption>
                  Student attendance for {data.session.className}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Student code</th>
                    <th scope="col">Full name</th>
                    <th scope="col">Attendance status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((student) => (
                    <tr key={student.enrollmentId}>
                      <th scope="row">{student.studentCode}</th>
                      <td>{student.fullName}</td>
                      <td>
                        <span
                          className={`session-status attendance-status-${(draft[student.enrollmentId] ?? student.attendanceStatus)?.toLowerCase() ?? "unmarked"}`}
                        >
                          {draft[student.enrollmentId] ??
                            student.attendanceStatus ??
                            "Unmarked"}
                        </span>
                        {editable && (
                          <select
                            aria-label={`Attendance for ${student.fullName} (${student.studentCode})`}
                            value={
                              draft[student.enrollmentId] ??
                              student.attendanceStatus ??
                              ""
                            }
                            disabled={saving}
                            onChange={(event) => {
                              const value = event.target.value;
                              setDraft((previous) => {
                                const next = { ...previous };
                                if (
                                  !value ||
                                  value === student.attendanceStatus
                                )
                                  delete next[student.enrollmentId];
                                else
                                  next[student.enrollmentId] =
                                    value as AttendanceStatus;
                                return next;
                              });
                              setNotice("");
                            }}
                          >
                            {student.attendanceStatus === null && (
                              <option value="">Unmarked</option>
                            )}
                            <option value="PRESENT">Present</option>
                            <option value="ABSENT">Absent</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
