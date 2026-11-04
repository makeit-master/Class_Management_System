import { useId, useRef, useState } from "react";

import "./CompleteSessionButton.css";

type SessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";
type AttendanceStatus = "PRESENT" | "ABSENT" | null;

type CompleteSessionButtonProps = {
  sessionId: string;
  status: SessionStatus;
  students: { enrollmentId: string; attendanceStatus: AttendanceStatus }[];
  canComplete: boolean;
  hasUnsavedChanges: boolean;
  onComplete: () => Promise<unknown>;
  onRefresh: () => Promise<void>;
};

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const response = error as { status?: number; response?: { status?: number } };
  return response.status ?? response.response?.status;
}

function completeError(error: unknown) {
  switch (getErrorStatus(error)) {
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You do not have permission to complete this session.";
    case 409:
      return "Session information changed. Review the latest attendance before trying again.";
    default:
      return "Could not complete this session. Please try again.";
  }
}

export default function CompleteSessionButton({
  sessionId,
  status,
  students,
  canComplete,
  hasUnsavedChanges,
  onComplete,
  onRefresh,
}: CompleteSessionButtonProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [isCompleting, setIsCompleting] = useState(false);
  const [completedLocally, setCompletedLocally] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const present = students.filter(
    (s) => s.attendanceStatus === "PRESENT",
  ).length;
  const absent = students.filter((s) => s.attendanceStatus === "ABSENT").length;
  const unmarked = students.filter((s) => s.attendanceStatus === null).length;
  const completed = status === "COMPLETED" || completedLocally;
  const canSubmit =
    canComplete &&
    status === "SCHEDULED" &&
    !completedLocally &&
    !hasUnsavedChanges &&
    students.length > 0 &&
    unmarked === 0 &&
    !isCompleting;

  async function confirmCompletion() {
    if (!canSubmit) return;
    setIsCompleting(true);
    setError("");
    setNotice("");

    try {
      await onComplete();
    } catch (cause) {
      setError(completeError(cause));
      dialog.current?.close();
      if ([401, 403, 409].includes(getErrorStatus(cause) ?? 0)) {
        try {
          await onRefresh();
        } catch {
          /* Keep the original error. */
        }
      }
      setIsCompleting(false);
      return;
    }

    // The write succeeded. Don't unlock the button if refreshing fails.
    setCompletedLocally(true);
    dialog.current?.close();
    setNotice("Session completed. Attendance is now read-only.");
    try {
      await onRefresh();
    } catch {
      setError(
        "Session completed, but refreshing failed. Reload this page to sync.",
      );
    } finally {
      setIsCompleting(false);
    }
  }

  if (!canComplete || status === "CANCELLED") return null;

  if (completed) {
    return (
      <div className="complete-session-section">
        <p className="complete-session-success" role="status">
          {notice || "Session completed. Attendance is read-only."}
        </p>
        {error && (
          <p className="complete-session-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  const hint = hasUnsavedChanges
    ? "Save attendance changes before completing the session."
    : students.length === 0
      ? "This session has no eligible students."
      : unmarked > 0
        ? `${unmarked} student(s) still unmarked.`
        : "";

  return (
    <div className="complete-session-section">
      <button
        type="button"
        className="complete-session-trigger"
        disabled={!canSubmit}
        aria-haspopup="dialog"
        onClick={() => {
          if (!canSubmit) return;
          setError("");
          dialog.current?.showModal();
        }}
      >
        Complete Session
      </button>
      {hint && <p className="complete-session-hint">{hint}</p>}
      {error && (
        <p className="complete-session-error" role="alert">
          {error}
        </p>
      )}

      <dialog
        ref={dialog}
        className="complete-session-dialog"
        aria-labelledby={headingId}
        data-session-id={sessionId}
        onCancel={(event) => {
          if (isCompleting) event.preventDefault();
        }}
      >
        <h2 id={headingId}>Complete Session?</h2>
        <p>
          Review the saved attendance summary before completing this session.
        </p>
        <div className="complete-session-summary">
          <p>
            <span>Present</span>
            <strong>{present}</strong>
          </p>
          <p>
            <span>Absent</span>
            <strong>{absent}</strong>
          </p>
          <p>
            <span>Unmarked</span>
            <strong>{unmarked}</strong>
          </p>
        </div>
        <p className="complete-session-warning">
          This action cannot be undone. Attendance will become read-only.
        </p>
        <div className="complete-session-actions">
          <button
            type="button"
            disabled={isCompleting}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="complete-session-confirm"
            disabled={!canSubmit}
            onClick={() => void confirmCompletion()}
          >
            {isCompleting ? "Completing..." : "Confirm Completion"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
