import { useEffect, useRef, useState } from "react";

import { dropEnrollment, EnrollmentApiError } from "./enrollment.api";

import "./DropStudentModal.css";

interface DropStudentModalProps {
  enrollmentId: string;
  studentName: string;
  className: string;
  token: string;
  onClose: () => void;
  onDropped: () => void;
}

function getDropErrorMessage(error: unknown): string {
  if (error instanceof EnrollmentApiError) {
    switch (error.status) {
      case 401:
        return "Your session has expired. Please log in again.";

      case 403:
        return "You do not have permission to drop students.";

      case 404:
        return "Enrollment not found. Refresh the list and try again.";

      case 409:
        return "This student has already been dropped or the enrollment status has changed.";

      default:
        return error.message;
    }
  }

  return "An unexpected error occurred. Please try again.";
}

export default function DropStudentModal({
  enrollmentId,
  studentName,
  className,
  token,
  onClose,
  onDropped,
}: DropStudentModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pendingRef = useRef(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Open the native modal and restore focus on cleanup.
  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  async function handleConfirm(): Promise<void> {
    if (pendingRef.current) {
      return;
    }

    pendingRef.current = true;

    setSubmitting(true);
    setError("");

    try {
      await dropEnrollment(enrollmentId, token);
      onDropped();
    } catch (err: unknown) {
      setError(getDropErrorMessage(err));

      pendingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="cms-drop-dialog"
      aria-labelledby="cms-drop-title"
      aria-describedby="cms-drop-description"
      onCancel={(event) => {
        event.preventDefault();

        if (!pendingRef.current) {
          onClose();
        }
      }}
    >
      <div className="cms-drop-content">
        <div className="cms-drop-icon" aria-hidden="true">
          !
        </div>

        <h2 id="cms-drop-title">Drop Student?</h2>

        <p id="cms-drop-description">
          Are you sure you want to drop <strong>{studentName}</strong> from{" "}
          <strong>{className}</strong>?
        </p>

        <div className="cms-drop-notice">
          The enrollment will be marked as Dropped. Attendance and grade history
          will be preserved.
        </div>

        {error && (
          <div className="cms-drop-error" role="alert">
            {error}
          </div>
        )}

        <div className="cms-drop-actions">
          <button
            type="button"
            className="cms-drop-cancel"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>

          <button
            type="button"
            className="cms-drop-confirm"
            onClick={() => void handleConfirm()}
            disabled={submitting}
          >
            {submitting ? "Dropping..." : "Confirm Drop"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
