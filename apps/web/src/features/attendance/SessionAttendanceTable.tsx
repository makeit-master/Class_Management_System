import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api-client";
import { getSessionAttendance } from "./attendance.api";
import type { SessionAttendanceData } from "./attendance.types";

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
    <section aria-label="Session attendance" aria-busy={loading}>
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
                : "Attendance is view-only. Recording attendance will be available in a later milestone."}
          </p>
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
              <dd>{data.summary.present}</dd>
            </div>
            <div>
              <dt>Absent</dt>
              <dd>{data.summary.absent}</dd>
            </div>
            <div>
              <dt>Unmarked</dt>
              <dd>{data.summary.unmarked}</dd>
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
                          className={`session-status attendance-status-${student.attendanceStatus?.toLowerCase() ?? "unmarked"}`}
                        >
                          {student.attendanceStatus ?? "Unmarked"}
                        </span>
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
