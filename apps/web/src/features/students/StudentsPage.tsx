import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import {
  getStudents,
  type StudentRecord,
  type StudentListResponse,
} from "./student-api";

import "./Students.css";

// ============================================================
// CONSTANTS
// ============================================================

const PAGE_SIZE = 20;

const INITIAL_PAGINATION: StudentListResponse["pagination"] = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 0,
};

const AVATAR_COLORS = ["violet", "blue", "green", "orange", "pink"] as const;

// ============================================================
// HELPERS
// ============================================================

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function studentColor(id: string): string {
  const hash = Array.from(id).reduce(
    (value, char) => value + char.charCodeAt(0),
    0,
  );

  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to load students.";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("vi-VN");
}

// ============================================================
// STUDENT AVATAR
// ============================================================

function StudentAvatar({ student }: { student: StudentRecord }) {
  return (
    <span
      className={`students-avatar students-avatar-${studentColor(student.id)}`}
    >
      {initials(student.fullName)}
    </span>
  );
}

// ============================================================
// STUDENTS PAGE
// ============================================================

export default function StudentsPage() {
  const { user, token } = useAuth();

  // ==========================================================
  // STUDENT LIST STATE
  // ==========================================================

  const [students, setStudents] = useState<StudentRecord[]>([]);

  const [pagination, setPagination] =
    useState<StudentListResponse["pagination"]>(INITIAL_PAGINATION);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);

  // ==========================================================
  // SEARCH & PAGINATION
  // ==========================================================

  const [query, setQuery] = useState("");

  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);

  // ==========================================================
  // EFFECT 1: DEBOUNCED SEARCH
  // ==========================================================

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextSearch = query.trim();

      setSearch(nextSearch);
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [query]);

  // ==========================================================
  // EFFECT 2: FETCH REAL STUDENTS
  // ==========================================================

  useEffect(() => {
    if (!token) {
      setStudents([]);
      setPagination(INITIAL_PAGINATION);
      setError("");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadStudents() {
      setLoading(true);
      setError("");

      try {
        const response = await getStudents(token!, {
          page,
          limit: PAGE_SIZE,
          search,
        });

        if (cancelled) return;

        setStudents(response.items);
        setPagination(response.pagination);
      } catch (caught) {
        if (cancelled) return;

        setStudents([]);
        setError(getErrorMessage(caught));
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
  }, [token, page, search, refreshKey]);

  // ==========================================================
  // HANDLERS
  // ==========================================================

  function handleSearch(value: string) {
    setQuery(value);
    setPage(1);
  }

  function handleRefresh() {
    setRefreshKey((previous) => previous + 1);
  }

  function previousPage() {
    setPage((current) => Math.max(1, current - 1));
  }

  function nextPage() {
    setPage((current) => Math.min(pagination.totalPages, current + 1));
  }

  // ==========================================================
  // DERIVED VALUES
  // ==========================================================

  const total = pagination.total;

  const totalPages = Math.max(1, pagination.totalPages);

  const firstItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;

  const lastItem = Math.min(page * PAGE_SIZE, total);

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="students-page">
      {/* =====================================================
          PAGE HEADER
          ===================================================== */}

      <div className="students-topbar">
        <div>
          <div className="students-eyebrow">
            <Users size={14} />
            STUDENT MANAGEMENT
          </div>

          <h2>
            All students{" "}
            <span className="students-count">{total} students</span>
          </h2>

          <p>Manage students and keep learning on track.</p>
        </div>

        <div className="students-toolbar-actions">
          <button
            type="button"
            className="students-btn"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* =====================================================
          TABLE PANEL
          ===================================================== */}

      <div className="students-panel students-table-panel">
        {/* SEARCH */}

        <div className="students-filters">
          <label className="students-search">
            <Search size={17} />

            <input
              type="search"
              value={query}
              onChange={(event) => handleSearch(event.target.value)}
              placeholder="Search by name or student code..."
              aria-label="Search students"
            />
          </label>

          <span className="students-results">
            {loading ? "Loading..." : `${total} results`}
          </span>
        </div>

        {/* LOADING STATE */}

        {loading && (
          <div className="students-empty" role="status" aria-live="polite">
            <RefreshCw size={24} />
            <p>Loading students from ClassFlow...</p>
          </div>
        )}

        {/* ERROR STATE */}

        {!loading && error && (
          <div className="students-empty" role="alert">
            <h3>Unable to load students</h3>

            <p>{error}</p>

            <button
              type="button"
              className="students-btn"
              onClick={handleRefresh}
            >
              <RefreshCw size={16} />
              Try again
            </button>
          </div>
        )}

        {/* REAL STUDENT TABLE */}

        {!loading && !error && (
          <>
            <div className="students-table-scroll">
              <table className="students-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Student Code</th>
                    <th>Phone</th>
                    <th>Active Classes</th>
                    <th>Created</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {students.map((student) => (
                    <tr key={student.id}>
                      {/* NAME + EMAIL */}

                      <td>
                        <div className="students-person">
                          <StudentAvatar student={student} />

                          <span>
                            <b>{student.fullName}</b>

                            <small>
                              <Mail size={12} /> {student.email || "No email"}
                            </small>
                          </span>
                        </div>
                      </td>

                      {/* STUDENT CODE */}

                      <td className="students-muted">{student.studentCode}</td>

                      {/* PHONE */}

                      <td className="students-muted">
                        {student.phone || "Not provided"}
                      </td>

                      {/* ACTIVE ENROLLMENTS */}

                      <td>
                        <span className="students-class-pill">
                          {student._count.enrollments}{" "}
                          {student._count.enrollments === 1
                            ? "class"
                            : "classes"}
                        </span>
                      </td>

                      {/* DATE CREATED */}

                      <td className="students-muted">
                        {formatDate(student.createdAt)}
                      </td>

                      {/* STATUS */}

                      <td>
                        <span className="students-status students-status-active">
                          <i />
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* EMPTY STATE */}

              {students.length === 0 && (
                <div className="students-empty">
                  <Users size={26} />

                  <h3>No students found</h3>

                  <p>
                    {search
                      ? "Try another name or student code."
                      : user?.role === "ADMIN"
                        ? "No active students have been added yet."
                        : "No students are currently assigned to your classes."}
                  </p>
                </div>
              )}
            </div>

            {/* PAGINATION */}

            <div className="students-pagination">
              <span>
                Showing {firstItem}–{lastItem} of {total} students
              </span>

              <div>
                <button
                  type="button"
                  className="students-btn"
                  disabled={page <= 1}
                  onClick={previousPage}
                >
                  <ChevronLeft size={15} />
                  Previous
                </button>

                <span className="students-page-number">
                  {page} / {totalPages}
                </span>

                <button
                  type="button"
                  className="students-btn"
                  disabled={page >= totalPages}
                  onClick={nextPage}
                >
                  Next
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
