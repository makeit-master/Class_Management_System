import { useEffect, useMemo, useState } from "react";

import { EnrollmentApiError, getEnrollments } from "./enrollment.api";

import DropStudentModal from "./DropStudentModal";

import EnrollStudentModal from "./EnrollmentStudentModal";

import type {
  CreateEnrollmentData,
  EnrollmentListData,
  EnrollmentListItem,
  EnrollmentStatus,
} from "./enrollment.types";

import "./ClassEnrollmentList.css";
import { useAuth } from "../../auth/auth-context";

interface ClassEnrollmentListProps {
  classId: string;
  token: string;
  onEnrollmentChanged?: () => void;
}

const PAGE_LIMIT = 10;

// ============================================================
// DATE FORMATTER
// ============================================================

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ============================================================
// ERROR HANDLER
// ============================================================

function getErrorMessage(error: unknown): string {
  if (error instanceof EnrollmentApiError) {
    switch (error.status) {
      case 401:
        return "Your session has expired. Please log in again.";

      case 403:
        return "You do not have permission to view enrollments for this class.";

      case 404:
        return "Class not found or archived.";

      default:
        return error.message;
    }
  }

  return "An unexpected error occurred. Please try again.";
}

// ============================================================
// CLASS ENROLLMENT LIST COMPONENT
// ============================================================

export default function ClassEnrollmentList({
  classId,
  token,
  onEnrollmentChanged,
}: ClassEnrollmentListProps) {
  const { user } = useAuth();

  const isAdmin = user?.role === "ADMIN";

  const [enrollModalOpen, setEnrollModalOpen] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");

  const [dropTarget, setDropTarget] = useState<EnrollmentListItem | null>(null);
  // ==========================================================
  // STATE
  // ==========================================================

  const [status, setStatus] = useState<EnrollmentStatus>("ACTIVE");

  const [page, setPage] = useState<number>(1);

  const [search, setSearch] = useState<string>("");

  const [data, setData] = useState<EnrollmentListData | null>(null);

  const [loading, setLoading] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState<number>(0);

  // ==========================================================
  // FETCH ENROLLMENTS
  // ==========================================================

  useEffect(() => {
    let cancelled = false;

    if (!classId || !token) {
      return;
    }

    async function loadEnrollments(): Promise<void> {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const result = await getEnrollments(
          {
            classId,
            status,
            page,
            limit: PAGE_LIMIT,
          },
          token,
        );

        if (!cancelled) {
          setData(result);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEnrollments();

    return () => {
      cancelled = true;
    };
  }, [classId, token, status, page, refreshKey]);

  // ==========================================================
  // SEARCH - CURRENT PAGE ONLY
  // ==========================================================

  const filteredItems = useMemo(() => {
    if (!data) {
      return [];
    }

    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return data.items;
    }

    return data.items.filter((item) => {
      const student = item.student;

      const searchableValues = [
        student.fullName,
        student.studentCode,
        student.email ?? "",
        student.phone ?? "",
      ];

      return searchableValues.some((value) =>
        value.toLowerCase().includes(keyword),
      );
    });
  }, [data, search]);

  // ==========================================================
  // EVENT HANDLERS
  // ==========================================================

  function handleStatusChange(nextStatus: EnrollmentStatus): void {
    if (nextStatus === status) {
      return;
    }

    setStatus(nextStatus);
    setPage(1);
    setSearch("");
  }

  function handleRefresh(): void {
    setRefreshKey((previous) => previous + 1);
  }

  function handleEnrollSuccess(result: CreateEnrollmentData): void {
    setEnrollModalOpen(false);

    setSuccessMessage(
      result.reactivated
        ? "Student re-enrolled successfully."
        : "Student enrolled successfully.",
    );

    setStatus("ACTIVE");
    setPage(1);
    setSearch("");

    // Refresh Enrollment List.
    setRefreshKey((previous) => previous + 1);

    // Refresh the class card count.
    onEnrollmentChanged?.();
  }

  function handleOpenDrop(enrollment: EnrollmentListItem): void {
    if (!isAdmin || enrollment.status !== "ACTIVE") {
      return;
    }

    setSuccessMessage("");
    setDropTarget(enrollment);
  }

  function handleDropSuccess(): void {
    setDropTarget(null);

    setSuccessMessage("Student dropped successfully.");

    setSearch("");

    // Move back if the last item on a later page
    // has been dropped.
    if (status === "ACTIVE" && data?.items.length === 1 && page > 1) {
      setPage((current) => Math.max(1, current - 1));
    }

    // Refresh Enrollment List.
    setRefreshKey((previous) => previous + 1);

    // Notify ClassesPage to refresh the class count.
    onEnrollmentChanged?.();
  }

  function handlePreviousPage(): void {
    setPage((previous) => Math.max(1, previous - 1));
  }

  function handleNextPage(): void {
    setPage((previous) => previous + 1);
  }

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const pagination = data?.pagination;

  const totalPages = pagination?.totalPages ?? 0;

  const canGoPrevious = page > 1;

  const canGoNext = page < totalPages;

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <section className="cms-enrollment">
      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="cms-enrollment-header">
        <div>
          <h2>Student Enrollments</h2>

          <p>Manage active and dropped enrollments for this class.</p>
        </div>

        <div className="cms-enrollment-header-actions">
          <button
            type="button"
            className="cms-enrollment-refresh"
            onClick={handleRefresh}
            disabled={loading || !token || !classId}
          >
            Refresh
          </button>

          {isAdmin && (
            <button
              type="button"
              className="cms-enrollment-add"
              onClick={() => {
                setSuccessMessage("");
                setEnrollModalOpen(true);
              }}
              disabled={!token || !classId}
            >
              + Enroll Student
            </button>
          )}
        </div>
      </div>
      {successMessage && (
        <div className="cms-enrollment-success" role="status">
          {successMessage}
        </div>
      )}

      {/* ===================================================
          STATUS TABS
      =================================================== */}

      <div
        className="cms-enrollment-tabs"
        role="group"
        aria-label="Enrollment status"
      >
        <button
          type="button"
          className={status === "ACTIVE" ? "active" : ""}
          aria-pressed={status === "ACTIVE"}
          onClick={() => handleStatusChange("ACTIVE")}
        >
          Active
        </button>

        <button
          type="button"
          className={status === "DROPPED" ? "active" : ""}
          aria-pressed={status === "DROPPED"}
          onClick={() => handleStatusChange("DROPPED")}
        >
          Dropped
        </button>
      </div>

      {/* ===================================================
          SEARCH AND TOTAL
      =================================================== */}

      <div className="cms-enrollment-toolbar">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search current page..."
          aria-label="Search students on current page"
        />

        <span>Total: {pagination?.total ?? 0} enrollments</span>
      </div>

      {/* ===================================================
          AUTHENTICATION STATE
      =================================================== */}

      {!token && (
        <div className="cms-enrollment-error" role="alert">
          Please log in to view enrollments.
        </div>
      )}

      {/* ===================================================
          MISSING CLASS ID
      =================================================== */}

      {token && !classId && (
        <div className="cms-enrollment-error" role="alert">
          No class has been selected.
        </div>
      )}

      {/* ===================================================
          LOADING STATE
      =================================================== */}

      {token && classId && loading && (
        <div className="cms-enrollment-state" role="status">
          Loading enrollments...
        </div>
      )}

      {/* ===================================================
          ERROR STATE
      =================================================== */}

      {token && classId && !loading && error && (
        <div className="cms-enrollment-error" role="alert">
          <p>{error}</p>

          <button type="button" onClick={handleRefresh}>
            Retry
          </button>
        </div>
      )}

      {/* ===================================================
          ENROLLMENT CONTENT
      =================================================== */}

      {token && classId && !loading && !error && data && (
        <>
          {/* ================================================
              EMPTY STATE
          ================================================ */}

          {filteredItems.length === 0 ? (
            <div className="cms-enrollment-state">
              {search.trim()
                ? "No matching students found on this page."
                : status === "ACTIVE"
                  ? "No active enrollments found."
                  : "No dropped enrollments found."}
            </div>
          ) : (
            /* ==============================================
                ENROLLMENT TABLE
            ============================================== */

            <div className="cms-enrollment-table-wrapper">
              <table className="cms-enrollment-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Student Code</th>
                    <th>Contact</th>
                    <th>Enrollment Date</th>
                    <th>Status</th>

                    {isAdmin && status === "ACTIVE" && <th>Actions</th>}
                  </tr>
                </thead>

                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id}>
                      {/* Student Name */}

                      <td>
                        <strong>{item.student.fullName}</strong>

                        {item.student.archivedAt && (
                          <small className="cms-archived">
                            Archived Student
                          </small>
                        )}
                      </td>

                      {/* Student Code */}

                      <td>{item.student.studentCode}</td>

                      {/* Contact Information */}

                      <td>
                        <div className="cms-contact">
                          <span>{item.student.email || "—"}</span>

                          <span>{item.student.phone || "—"}</span>
                        </div>
                      </td>

                      {/* Enrollment Date */}

                      <td>{formatDate(item.enrolledAt)}</td>

                      {/* Enrollment Status */}

                      <td>
                        <span
                          className={`cms-enrollment-badge ${
                            item.status === "ACTIVE"
                              ? "is-active"
                              : "is-dropped"
                          }`}
                        >
                          {item.status === "ACTIVE" ? "Active" : "Dropped"}
                        </span>
                      </td>

                      {/* M17.4.4 - DROP ACTION */}

                      {isAdmin && status === "ACTIVE" && (
                        <td>
                          <button
                            type="button"
                            className="cms-enrollment-drop"
                            onClick={() => handleOpenDrop(item)}
                            disabled={loading}
                            aria-label={`Drop ${item.student.fullName} from class`}
                          >
                            Drop
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ================================================
              PAGINATION
          ================================================ */}

          <div className="cms-enrollment-pagination">
            <span>
              Page {page} of {Math.max(totalPages, 1)}
            </span>

            <div className="cms-enrollment-page-actions">
              <button
                type="button"
                disabled={!canGoPrevious || loading}
                onClick={handlePreviousPage}
              >
                Previous
              </button>

              <button
                type="button"
                disabled={!canGoNext || loading}
                onClick={handleNextPage}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
      {isAdmin && enrollModalOpen && (
        <EnrollStudentModal
          classId={classId}
          className={data?.class.name ?? "this class"}
          token={token}
          onClose={() => setEnrollModalOpen(false)}
          onEnrolled={handleEnrollSuccess}
        />
      )}

      {/* M17.4.4 - DROP STUDENT MODAL */}

      {isAdmin && dropTarget && (
        <DropStudentModal
          enrollmentId={dropTarget.id}
          studentName={dropTarget.student.fullName}
          className={data?.class.name ?? "this class"}
          token={token}
          onClose={() => setDropTarget(null)}
          onDropped={handleDropSuccess}
        />
      )}
    </section>
  );
}
