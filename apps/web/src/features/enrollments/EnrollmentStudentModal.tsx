import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  getStudents,
  type StudentListResponse,
  type StudentRecord,
} from "../students/student-api";

import { createEnrollment } from "./enrollment.api";

import type { CreateEnrollmentData } from "./enrollment.types";

import "./EnrollmentStudentModal.css";

interface EnrollStudentModalProps {
  classId: string;
  className: string;
  token: string;
  onClose: () => void;
  onEnrolled: (result: CreateEnrollmentData) => void;
}

const PAGE_SIZE = 10;
const SEARCH_DELAY = 350;

// ============================================================
// ERROR HANDLING
// ============================================================

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred. Please try again.";
}

// ============================================================
// ENROLL STUDENT MODAL
// ============================================================

export default function EnrollStudentModal({
  classId,
  className,
  token,
  onClose,
  onEnrolled,
}: EnrollStudentModalProps) {
  // ==========================================================
  // REFS
  // ==========================================================

  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef(false);

  // ==========================================================
  // STATE
  // ==========================================================

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);

  const [students, setStudents] = useState<StudentListResponse | null>(null);

  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(
    null,
  );

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);

  // ==========================================================
  // OPEN NATIVE DIALOG
  // ==========================================================

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }

    searchRef.current?.focus();

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  // ==========================================================
  // DEBOUNCED SEARCH
  // ==========================================================

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DELAY);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [search]);

  // ==========================================================
  // LOAD ACTIVE STUDENTS
  // ==========================================================

  useEffect(() => {
    let cancelled = false;

    async function loadStudents(): Promise<void> {
      setLoading(true);
      setLoadError("");
      setStudents(null);

      try {
        const result = await getStudents(token, {
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch,
          status: "active",
        });

        if (!cancelled) {
          setStudents(result);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setLoadError(getErrorMessage(error));
          setStudents(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadStudents();

    return () => {
      cancelled = true;
    };
  }, [token, page, debouncedSearch, refreshKey]);

  // ==========================================================
  // EVENT HANDLERS
  // ==========================================================

  function handleSearchChange(value: string): void {
    setSearch(value);
    setPage(1);
    setSelectedStudent(null);
    setSubmitError("");
  }

  function handleSelectStudent(student: StudentRecord): void {
    setSelectedStudent(student);
    setSubmitError("");
  }

  function handlePreviousPage(): void {
    setSelectedStudent(null);
    setPage((current) => Math.max(1, current - 1));
  }

  function handleNextPage(): void {
    setSelectedStudent(null);
    setPage((current) => current + 1);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!selectedStudent || pendingRef.current) {
      return;
    }

    // Prevent duplicate requests before React re-renders.
    pendingRef.current = true;

    setSubmitting(true);
    setSubmitError("");

    try {
      const result = await createEnrollment(
        {
          studentId: selectedStudent.id,
          classId,
        },
        token,
      );

      onEnrolled(result);
    } catch (error: unknown) {
      setSubmitError(getErrorMessage(error));
    } finally {
      pendingRef.current = false;
      setSubmitting(false);
    }
  }

  // ==========================================================
  // DERIVED STATE
  // ==========================================================

  const totalPages = students?.pagination.totalPages ?? 0;

  const searchPending = search.trim() !== debouncedSearch;

  const isBusy = loading || searchPending;

  const canSubmit =
    selectedStudent !== null && !submitting && !isBusy && !loadError;

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <dialog
      ref={dialogRef}
      className="cms-enroll-modal"
      aria-labelledby="cms-enroll-title"
      aria-describedby="cms-enroll-description"
      aria-busy={submitting}
      onCancel={(event) => {
        event.preventDefault();

        if (!pendingRef.current) {
          onClose();
        }
      }}
    >
      {/* HEADER */}

      <div className="cms-enroll-header">
        <div>
          <h2 id="cms-enroll-title">Enroll Student</h2>

          <p id="cms-enroll-description">
            Select a student to enroll in <strong>{className}</strong>.
          </p>
        </div>

        <button
          type="button"
          className="cms-enroll-close"
          aria-label="Close dialog"
          onClick={onClose}
          disabled={submitting}
        >
          ×
        </button>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)}>
        {/* SEARCH */}

        <div className="cms-enroll-search">
          <label htmlFor="cms-enroll-search">Search students</label>

          <input
            ref={searchRef}
            id="cms-enroll-search"
            type="search"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Name, student code or email..."
            autoComplete="off"
            disabled={submitting}
          />
        </div>

        {/* SEARCH RESULTS */}

        <div className="cms-enroll-results" aria-busy={isBusy}>
          {isBusy ? (
            <div className="cms-enroll-state" role="status">
              Searching students...
            </div>
          ) : loadError ? (
            <div className="cms-enroll-state">
              <p role="alert">{loadError}</p>

              <button
                type="button"
                className="cms-enroll-secondary"
                onClick={() => setRefreshKey((current) => current + 1)}
              >
                Retry
              </button>
            </div>
          ) : !students || students.items.length === 0 ? (
            <div className="cms-enroll-state">No active students found.</div>
          ) : (
            <div
              className="cms-enroll-student-list"
              role="group"
              aria-label="Select a student"
            >
              {students.items.map((student) => {
                const isSelected = selectedStudent?.id === student.id;

                return (
                  <label
                    key={student.id}
                    className={`cms-enroll-student ${
                      isSelected ? "is-selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="enrollmentStudent"
                      value={student.id}
                      checked={isSelected}
                      onChange={() => handleSelectStudent(student)}
                      disabled={submitting}
                    />

                    <span className="cms-enroll-student-info">
                      <strong>{student.fullName}</strong>

                      <small>{student.studentCode}</small>

                      {student.email && <small>{student.email}</small>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* PAGINATION */}

        {students && totalPages > 0 && !loadError && (
          <div className="cms-enroll-pagination">
            <span>
              Page {page} of {totalPages}
            </span>

            <div>
              <button
                type="button"
                className="cms-enroll-secondary"
                onClick={handlePreviousPage}
                disabled={page <= 1 || isBusy || submitting}
              >
                Previous
              </button>

              <button
                type="button"
                className="cms-enroll-secondary"
                onClick={handleNextPage}
                disabled={page >= totalPages || isBusy || submitting}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* SUBMISSION ERROR */}

        {submitError && (
          <p className="cms-enroll-error" role="alert">
            {submitError}
          </p>
        )}

        {/* ACTIONS */}

        <div className="cms-enroll-actions">
          <button
            type="button"
            className="cms-enroll-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="cms-enroll-primary"
            disabled={!canSubmit}
          >
            {submitting ? "Enrolling..." : "Enroll Student"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
