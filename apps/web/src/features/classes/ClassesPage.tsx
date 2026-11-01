import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  LayoutGrid,
  List,
  Plus,
  Search,
  Users,
  Clock3,
  MapPin,
  RefreshCw,
  X,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";

import {
  getClasses,
  getTeacherOptions,
  createClass,
  type ClassRecord,
  type ClassListResponse,
  type TeacherOption,
} from "../../classes/class-api";

import "./Classes.css";

// ============================================================
// TYPES & CONSTANTS
// ============================================================

type ViewMode = "grid" | "list";

const COLORS = ["violet", "blue", "orange", "green", "pink"] as const;

const PAGE_SIZE = 20;

const INITIAL_PAGINATION: ClassListResponse["pagination"] = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 0,
};

// ============================================================
// HELPERS
// ============================================================

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(-2)
    .join("")
    .toUpperCase();
}

function classColor(id: string) {
  const hash = Array.from(id).reduce(
    (value, char) => value + char.charCodeAt(0),
    0,
  );

  return COLORS[hash % COLORS.length];
}

function getTeacherName(item: ClassRecord): string {
  return item.teacher.user.fullName;
}

function getGrade(name: string): string | null {
  return name.match(/\b(10|11|12)\b/)?.[0] ?? null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ============================================================
// COMPONENT
// ============================================================

export default function ClassesPage() {
  const { user, token } = useAuth();

  const isAdmin = user?.role === "ADMIN";

  // ----------------------------------------------------------
  // CLASS LIST STATE
  // ----------------------------------------------------------

  const [classes, setClasses] = useState<ClassRecord[]>([]);

  const [pagination, setPagination] =
    useState<ClassListResponse["pagination"]>(INITIAL_PAGINATION);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // ----------------------------------------------------------
  // SEARCH & FILTER STATE
  // ----------------------------------------------------------

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  const [grade, setGrade] = useState("All grades");
  const [teacher, setTeacher] = useState("All teachers");

  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewMode>("grid");

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ----------------------------------------------------------
  // CREATE CLASS STATE
  // ----------------------------------------------------------

  const [showCreate, setShowCreate] = useState(false);

  const [teacherOptions, setTeacherOptions] = useState<TeacherOption[]>([]);

  const [loadingTeachers, setLoadingTeachers] = useState(false);

  const [teacherError, setTeacherError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // ==========================================================
  // EFFECT 1: DEBOUNCED SEARCH
  // ==========================================================

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
      setSelectedId(null);
    }, 350);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [query]);

  // ==========================================================
  // EFFECT 2: FETCH CLASSES
  // ==========================================================

  useEffect(() => {
    if (!token) {
      setClasses([]);
      setPagination(INITIAL_PAGINATION);
      setError("");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadClasses() {
      setLoading(true);
      setError("");

      try {
        const response = await getClasses(token!, {
          page,
          limit: PAGE_SIZE,
          search,
        });

        if (cancelled) return;

        setClasses(response.items);
        setPagination(response.pagination);
      } catch (caught) {
        if (cancelled) return;

        setClasses([]);
        setError(getErrorMessage(caught, "Unable to load classes."));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadClasses();

    return () => {
      cancelled = true;
    };
  }, [token, page, search, refreshKey]);

  // ==========================================================
  // EFFECT 3: FETCH TEACHERS WHEN CREATE MODAL OPENS
  // ==========================================================

  useEffect(() => {
    if (!showCreate || !token || !isAdmin) {
      return;
    }

    let cancelled = false;

    async function loadTeachers() {
      setLoadingTeachers(true);
      setTeacherError("");
      setTeacherOptions([]);

      try {
        const result = await getTeacherOptions(token!);

        if (cancelled) return;

        setTeacherOptions(result);
      } catch (caught) {
        if (cancelled) return;

        setTeacherError(getErrorMessage(caught, "Unable to load teachers."));
      } finally {
        if (!cancelled) {
          setLoadingTeachers(false);
        }
      }
    }

    void loadTeachers();

    return () => {
      cancelled = true;
    };
  }, [showCreate, token, isAdmin]);

  // ==========================================================
  // DERIVED DATA
  // ==========================================================

  const teachers = useMemo(() => {
    return [...new Set(classes.map(getTeacherName))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [classes]);

  const filteredClasses = useMemo(() => {
    return classes.filter((item) => {
      const matchGrade =
        grade === "All grades" || getGrade(item.name) === grade;

      const matchTeacher =
        teacher === "All teachers" || getTeacherName(item) === teacher;

      return matchGrade && matchTeacher;
    });
  }, [classes, grade, teacher]);

  // ==========================================================
  // HANDLERS
  // ==========================================================

  function retryLoadClasses() {
    setRefreshKey((previous) => previous + 1);
  }

  function openCreateModal() {
    if (!isAdmin) return;

    setFormError("");
    setTeacherError("");
    setTeacherOptions([]);
    setShowCreate(true);
  }

  function closeCreateModal() {
    if (submitting) return;

    setShowCreate(false);
    setFormError("");
  }

  async function handleCreateClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !isAdmin || submitting) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("name") ?? "").trim();

    const subject = String(formData.get("subject") ?? "").trim();

    const teacherId = String(formData.get("teacherId") ?? "").trim();

    const room = String(formData.get("room") ?? "").trim();

    const description = String(formData.get("description") ?? "").trim();

    if (!name) {
      setFormError("Class name is required.");
      return;
    }

    if (!teacherId) {
      setFormError("Please select a teacher.");
      return;
    }

    if (!teacherOptions.some((option) => option.id === teacherId)) {
      setFormError("Invalid teacher selection.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      await createClass(token, {
        name,
        teacherId,
        subject: subject || null,
        room: room || null,
        description: description || null,
      });

      // Close modal.
      setShowCreate(false);

      // Reset filters so new class can be found.
      setQuery("");
      setSearch("");
      setGrade("All grades");
      setTeacher("All teachers");
      setSelectedId(null);
      setPage(1);

      // Re-fetch classes from backend.
      setRefreshKey((previous) => previous + 1);
    } catch (caught) {
      setFormError(getErrorMessage(caught, "Unable to create class."));
    } finally {
      setSubmitting(false);
    }
  }

  function toggleDetails(classId: string) {
    setSelectedId((current) => (current === classId ? null : classId));
  }

  function goToPreviousPage() {
    setPage((current) => Math.max(1, current - 1));
    setSelectedId(null);
  }

  function goToNextPage() {
    setPage((current) => Math.min(pagination.totalPages, current + 1));
    setSelectedId(null);
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="classes-ui">
      {/* =====================================================
          TOOLBAR
      ===================================================== */}

      <div className="classes-toolbar">
        <div>
          <h2>
            All classes{" "}
            <span className="classes-count">{pagination.total} classes</span>
          </h2>

          <p>Manage your classes and keep learning on track.</p>
        </div>

        {isAdmin && (
          <button
            type="button"
            className="classes-primary"
            onClick={openCreateModal}
          >
            <Plus size={17} />
            New Class
          </button>
        )}
      </div>

      {/* =====================================================
          SEARCH & FILTERS
      ===================================================== */}

      <div className="classes-filters">
        <label className="classes-search">
          <Search size={17} />

          <input
            aria-label="Search classes"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search classes by name..."
          />
        </label>

        <select
          aria-label="Filter by grade"
          value={grade}
          onChange={(event) => setGrade(event.target.value)}
        >
          <option>All grades</option>
          <option value="10">Grade 10</option>
          <option value="11">Grade 11</option>
          <option value="12">Grade 12</option>
        </select>

        <select
          aria-label="Filter by teacher"
          value={teacher}
          onChange={(event) => setTeacher(event.target.value)}
        >
          <option>All teachers</option>

          {teachers.map((teacherName) => (
            <option key={teacherName} value={teacherName}>
              {teacherName}
            </option>
          ))}
        </select>

        <div className="classes-view-switch" aria-label="Layout mode">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            className={view === "grid" ? "selected" : ""}
            onClick={() => setView("grid")}
          >
            <LayoutGrid size={18} />
          </button>

          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === "list"}
            className={view === "list" ? "selected" : ""}
            onClick={() => setView("list")}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* =====================================================
          LOADING STATE
      ===================================================== */}

      {loading && (
        <div className="classes-empty" role="status">
          <RefreshCw size={28} />

          <h3>Loading classes...</h3>

          <p>Fetching your classes from the server.</p>
        </div>
      )}

      {/* =====================================================
          ERROR STATE
      ===================================================== */}

      {!loading && error && (
        <div className="classes-empty" role="alert">
          <h3>Unable to load classes</h3>

          <p>{error}</p>

          <button
            type="button"
            className="classes-primary"
            onClick={retryLoadClasses}
          >
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      )}

      {/* =====================================================
          CLASS LIST
      ===================================================== */}

      {!loading && !error && (
        <>
          <div className={`classes-grid ${view === "list" ? "is-list" : ""}`}>
            {filteredClasses.map((item) => {
              const color = classColor(item.id);
              const teacherName = getTeacherName(item);
              const expanded = selectedId === item.id;

              return (
                <article className="classes-card" key={item.id}>
                  {/* Card header */}

                  <div className="classes-card-top">
                    <span className={`classes-icon classes-${color}`}>
                      <BookOpen size={22} strokeWidth={1.7} />
                    </span>

                    <span className="classes-status">
                      <span />
                      Active
                    </span>
                  </div>

                  {/* Class information */}

                  <h3>{item.name}</h3>

                  <p className="classes-subject">
                    {item.subject || "Subject not assigned"}
                  </p>

                  {/* Teacher */}

                  <div className="classes-teacher">
                    <span className={`classes-avatar classes-${color}`}>
                      {initials(teacherName)}
                    </span>

                    <span>
                      <strong>{teacherName}</strong>
                      <small>Class teacher</small>
                    </span>
                  </div>

                  {/* Metadata */}

                  <div className="classes-metadata">
                    <span>
                      <Users size={15} />
                      {item._count.enrollments} students
                    </span>

                    <span>
                      <MapPin size={15} />
                      {item.room || "Room not assigned"}
                    </span>
                  </div>

                  {/* Expanded details */}

                  {expanded && (
                    <div className="classes-detail">
                      <span>
                        <Clock3 size={15} />
                        Schedule not available yet
                      </span>

                      <span>
                        <CalendarDays size={15} />
                        Created {new Date(item.createdAt).toLocaleDateString()}
                      </span>

                      {item.description && <span>{item.description}</span>}
                    </div>
                  )}

                  {/* Detail toggle */}

                  <button
                    type="button"
                    className="classes-details-button"
                    aria-expanded={expanded}
                    onClick={() => toggleDetails(item.id)}
                  >
                    {expanded ? "Hide class details" : "View class details"}{" "}
                    <ArrowRight size={15} />
                  </button>
                </article>
              );
            })}
          </div>

          {/* Empty state */}

          {filteredClasses.length === 0 && (
            <div className="classes-empty">
              <Search size={28} />

              <h3>No classes found</h3>

              <p>
                {classes.length === 0
                  ? "There are no active classes matching your search."
                  : "Try another grade or teacher filter."}
              </p>
            </div>
          )}

          {/* Pagination */}

          {pagination.totalPages > 1 && (
            <div
              className="classes-modal-actions"
              style={{
                justifyContent: "center",
                marginTop: 24,
              }}
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={goToPreviousPage}
              >
                Previous
              </button>

              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={goToNextPage}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* =====================================================
          CREATE CLASS MODAL
      ===================================================== */}

      {showCreate && isAdmin && (
        <div
          className="classes-modal-overlay"
          onMouseDown={(event) => {
            if (!submitting && event.target === event.currentTarget) {
              closeCreateModal();
            }
          }}
        >
          <section
            className="classes-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-class-heading"
          >
            {/* Modal header */}

            <div className="classes-modal-header">
              <div>
                <h2 id="create-class-heading">Create new class</h2>

                <p>Add a new class to ClassFlow.</p>
              </div>

              <button
                type="button"
                aria-label="Close"
                disabled={submitting}
                onClick={closeCreateModal}
              >
                <X size={20} />
              </button>
            </div>

            {/* Create form */}

            <form onSubmit={handleCreateClass}>
              <label>
                Class name
                <input
                  name="name"
                  required
                  maxLength={120}
                  placeholder="e.g. Mathematics 10A3"
                />
              </label>

              <label>
                Subject
                <input
                  name="subject"
                  maxLength={120}
                  placeholder="e.g. Mathematics"
                />
              </label>

              <label>
                Teacher
                <select
                  name="teacherId"
                  required
                  defaultValue=""
                  disabled={loadingTeachers || teacherOptions.length === 0}
                >
                  <option value="">
                    {loadingTeachers
                      ? "Loading teachers..."
                      : "Select a teacher"}
                  </option>

                  {teacherOptions.map((teacherOption) => (
                    <option key={teacherOption.id} value={teacherOption.id}>
                      {teacherOption.fullName}
                      {teacherOption.employeeCode
                        ? ` (${teacherOption.employeeCode})`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>

              {/* Teacher fetch error */}

              {teacherError && <p role="alert">{teacherError}</p>}

              {/* No available teachers */}

              {!loadingTeachers &&
                !teacherError &&
                teacherOptions.length === 0 && (
                  <p>
                    No teacher profiles available. Create a teacher profile
                    first.
                  </p>
                )}

              <label>
                Room
                <input
                  name="room"
                  maxLength={100}
                  placeholder="e.g. Room 201"
                />
              </label>

              <label>
                Description
                <textarea
                  name="description"
                  maxLength={2000}
                  rows={3}
                  placeholder="Class description..."
                />
              </label>

              {/* Form error */}

              {formError && <p role="alert">{formError}</p>}

              {/* Modal actions */}

              <div className="classes-modal-actions">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={closeCreateModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="classes-primary"
                  disabled={
                    submitting || loadingTeachers || teacherOptions.length === 0
                  }
                >
                  <Plus size={16} />

                  {submitting ? "Creating..." : "Create class"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
