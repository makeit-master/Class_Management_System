import { confirmAttendanceNavigation } from "../../lib/unsaved-changes";
import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useAuth } from "../../auth/auth-context";
import { can } from "../../auth/permissions";
import SessionAttendanceTable from "./SessionAttendanceTable";
import { getClasses, type ClassListResponse } from "../../classes/class-api";
import { ApiError } from "../../lib/api-client";
import { getClassSessions } from "./attendance.api";
import type {
  SessionListData,
  SessionListItem,
  SessionStatus,
} from "./attendance.types";
import "./SessionList.css";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return "Your session has expired. Please log in again.";
    if (error.status === 403)
      return "You do not have permission to view this class.";
    if (error.status === 404)
      return "This class was not found or has been archived.";
    if (error.status === 0)
      return "Cannot connect to the server. Please try again.";
  }
  return "Unable to load data. Please try again.";
}

function sessionTime(session: SessionListItem): string {
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  };
  return `${new Date(session.startsAt).toLocaleString("en-US", options)} – ${new Date(session.endsAt).toLocaleString("en-US", options)}`;
}

export default function SessionListPage() {
  const { token, user } = useAuth();
  return (
    <div className="session-page">
      <header className="session-heading">
        <CalendarDays size={28} aria-hidden="true" />
        <div>
          <h2>Class sessions</h2>
          <p>Choose a class and select a session for attendance.</p>
        </div>
      </header>
      {!can(user, "attendance:view") && (
        <p role="alert">You do not have permission to view attendance.</p>
      )}
      {token && can(user, "attendance:view") && (
        <ClassChooser
          key={token}
          token={token}
          teacher={user?.role === "TEACHER"}
        />
      )}
    </div>
  );
}

function ClassChooser({ token, teacher }: { token: string; teacher: boolean }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ClassListResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [classId, setClassId] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await getClasses(token, { page, limit: 20 });
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, page, retry]);

  return (
    <>
      <section
        className="session-panel"
        aria-label="Class selection"
        aria-busy={loading}
      >
        <p>{teacher ? "Your assigned classes" : "All active classes"}</p>
        {loading ? (
          <p role="status">Loading classes…</p>
        ) : error ? (
          <div role="alert">
            <p>{error}</p>
            <button onClick={() => setRetry((value) => value + 1)}>
              Retry classes
            </button>
          </div>
        ) : (
          data && (
            <>
              <label className="session-field">
                Class
                <select
                  aria-label="Class"
                  value={classId}
                  onChange={(event) => {
                    if (confirmAttendanceNavigation())
                      setClassId(event.target.value);
                  }}
                >
                  <option value="">Choose a class</option>
                  {data.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.teacher.user.fullName}
                    </option>
                  ))}
                </select>
              </label>
              {data.items.length === 0 && (
                <p role="status">No active classes are available.</p>
              )}
              {data.pagination.totalPages > 1 && (
                <div className="session-paging">
                  <button
                    disabled={page <= 1}
                    onClick={() => {
                      if (!confirmAttendanceNavigation()) return;
                      setClassId("");
                      setPage(page - 1);
                    }}
                  >
                    Previous classes
                  </button>
                  <span>
                    Class page {page} of {data.pagination.totalPages}
                  </span>
                  <button
                    disabled={page >= data.pagination.totalPages}
                    onClick={() => {
                      if (!confirmAttendanceNavigation()) return;
                      setClassId("");
                      setPage(page + 1);
                    }}
                  >
                    Next classes
                  </button>
                </div>
              )}
            </>
          )
        )}
      </section>
      {!loading && !error && classId ? (
        <ClassSessions key={classId} token={token} classId={classId} />
      ) : (
        !loading &&
        !error && <p role="status">Select a class to view its sessions.</p>
      )}
    </>
  );
}

function ClassSessions({ token, classId }: { token: string; classId: string }) {
  const [status, setStatus] = useState<SessionStatus | "">("");
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState<SessionListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<SessionListItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setData(null);
      setError("");
      try {
        const result = await getClassSessions(token, classId, {
          page,
          limit: 10,
          status: status || undefined,
        });
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, classId, page, status, retry]);

  return (
    <section className="session-panel" aria-label="Sessions">
      <div className="session-toolbar">
        <h3>Sessions</h3>
        <label className="session-field">
          Status
          <select
            aria-label="Status"
            value={status}
            onChange={(event) => {
              if (!confirmAttendanceNavigation()) return;
              setStatus(event.target.value as SessionStatus | "");
              setPage(1);
              setSelected(null);
            }}
          >
            <option value="">All statuses</option>
            <option value="SCHEDULED">SCHEDULED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </label>
      </div>
      <p className="session-muted">
        Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}.
      </p>
      <div aria-busy={loading}>
        {loading && <p role="status">Loading sessions…</p>}
        {!loading && error && (
          <div role="alert">
            <p>{error}</p>
            <button onClick={() => setRetry((value) => value + 1)}>
              Retry sessions
            </button>
          </div>
        )}
        {!loading && !error && data && (
          <>
            {data.items.length === 0 ? (
              <p role="status">
                {status
                  ? "No sessions match this status."
                  : "No sessions have been scheduled for this class."}
              </p>
            ) : (
              <div className="session-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Date and time</th>
                      <th scope="col">Status</th>
                      <th scope="col">Attendance records</th>
                      <th scope="col">Selection</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((session) => (
                      <tr key={session.id}>
                        <td>{sessionTime(session)}</td>
                        <td>
                          <span
                            className={`session-status session-status-${session.status.toLowerCase()}`}
                          >
                            {session.status}
                          </span>
                        </td>
                        <td>{session.attendanceCount}</td>
                        <td>
                          <button
                            aria-pressed={selected?.id === session.id}
                            onClick={() => {
                              if (
                                selected?.id !== session.id &&
                                !confirmAttendanceNavigation()
                              )
                                return;
                              setSelected(session);
                            }}
                          >
                            {selected?.id === session.id
                              ? "Selected"
                              : "Select session"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="session-paging">
              <button
                disabled={page <= 1}
                onClick={() => {
                  if (!confirmAttendanceNavigation()) return;
                  setPage(page - 1);
                  setSelected(null);
                }}
              >
                Previous sessions
              </button>
              <span>
                {data.pagination.total} sessions · Page {page} of{" "}
                {Math.max(1, data.pagination.totalPages)}
              </span>
              <button
                disabled={page >= data.pagination.totalPages}
                onClick={() => {
                  if (!confirmAttendanceNavigation()) return;
                  setPage(page + 1);
                  setSelected(null);
                }}
              >
                Next sessions
              </button>
            </div>
          </>
        )}
      </div>
      {selected && !loading && !error && (
        <aside className="session-selection" aria-label="Selected session">
          <h3>Selected session</h3>
          <p>
            {sessionTime(selected)} · {selected.status}
          </p>
          <p className="session-muted">Session ID: {selected.id}</p>
          <p>
            {selected.status === "CANCELLED"
              ? "This session is cancelled. Attendance cannot be recorded."
              : "View attendance for the selected session below."}
          </p>
          <button
            onClick={() => {
              if (confirmAttendanceNavigation()) setSelected(null);
            }}
          >
            Clear selection
          </button>
          <SessionAttendanceTable
            key={selected.id}
            token={token}
            sessionId={selected.id}
            onCompleted={() => {
              setSelected(
                status === "SCHEDULED"
                  ? null
                  : { ...selected, status: "COMPLETED" },
              );
              setRetry((value) => value + 1);
            }}
          />
        </aside>
      )}
    </section>
  );
}
