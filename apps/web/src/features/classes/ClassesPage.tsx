import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  LayoutGrid,
  List,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";

import {
  createClass,
  getClasses,
  getTeacherOptions,
  updateClass,
  type ClassRecord,
  type ClassListResponse,
  type TeacherOption,
} from "../../classes/class-api";

import "./Classes.css";

// ============================================================
// TYPES & CONSTANTS
// ============================================================

type ViewMode = "grid" | "list";
type ModalMode = "create" | "edit" | null;

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
// CLASSES PAGE
// ============================================================

export default function ClassesPage() {
  const { user, token } = useAuth();

  const isAdmin = user?.role === "ADMIN";

  // ----------------------------------------------------------
  // CLASS LIST
  // ----------------------------------------------------------

  const [classes, setClasses] = useState<ClassRecord[]>([]);

  const [pagination, setPagination] =
    useState<ClassListResponse["pagination"]>(INITIAL_PAGINATION);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // ----------------------------------------------------------
  // FILTERS & VIEW
  // ----------------------------------------------------------

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("All grades");
  const [teacher, setTeacher] = useState("All teachers");

  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewMode>("grid");

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ----------------------------------------------------------
  // CREATE / EDIT MODAL
  // ----------------------------------------------------------

  const [modalMode, setModalMode] = useState<ModalMode>(null);

  const [editingClass, setEditingClass] = useState<ClassRecord | null>(null);

  const [teacherOptions, setTeacherOptions] = useState<TeacherOption[]>([]);

  const [loadingTeachers, setLoadingTeachers] = useState(false);

  const [teacherError, setTeacherError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const modalOpen = modalMode !== null;
  const isEditing = modalMode === "edit";

  // ==========================================================
  // EFFECT 1: DEBOUNCED SEARCH
  // ==========================================================

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
      setSelectedId(null);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [query]);

  // ==========================================================
  // EFFECT 2: LOAD CLASSES
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
  // EFFECT 3: LOAD TEACHER OPTIONS FOR CREATE / EDIT
  // ==========================================================

  useEffect(() => {
    if (!modalOpen || !token || !isAdmin) {
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
  }, [modalOpen, token, isAdmin]);

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

  function resetModalState() {
    setFormError("");
    setTeacherError("");
    setTeacherOptions([]);
  }

  function openCreateModal() {
    if (!isAdmin) return;

    resetModalState();
    setEditingClass(null);
    setModalMode("create");
  }

  function openEditModal(item: ClassRecord) {
    if (!isAdmin) return;

    resetModalState();
    setEditingClass(item);
    setModalMode("edit");
  }

  function closeModal() {
    if (submitting) return;

    setModalMode(null);
    setEditingClass(null);
    resetModalState();
  }

  function refreshClassesAfterSave() {
    setQuery("");
    setSearch("");
    setGrade("All grades");
    setTeacher("All teachers");
    setSelectedId(null);
    setPage(1);

    setRefreshKey((previous) => previous + 1);
  }

  async function handleSubmitClass(event: FormEvent<HTMLFormElement>) {
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

    const validTeacher = teacherOptions.some(
      (option) => option.id === teacherId,
    );

    if (!validTeacher) {
      setFormError("Invalid teacher selection.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const payload = {
        name,
        teacherId,
        subject: subject || null,
        room: room || null,
        description: description || null,
      };

      if (isEditing) {
        if (!editingClass) {
          throw new Error("No class selected for editing.");
        }

        await updateClass(token, editingClass.id, payload);
      } else {
        await createClass(token, payload);
      }

      setModalMode(null);
      setEditingClass(null);

      refreshClassesAfterSave();
    } catch (caught) {
      setFormError(
        getErrorMessage(
          caught,
          isEditing ? "Unable to update class." : "Unable to create class.",
        ),
      );
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
      {/* TOOLBAR */}

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

      {/* FILTERS */}

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

      {/* LOADING */}

      {loading && (
        <div className="classes-empty" role="status">
          <RefreshCw size={28} />
          <h3>Loading classes...</h3>
          <p>Fetching your classes from the server.</p>
        </div>
      )}

      {/* ERROR */}

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

      {/* CLASS CARDS */}

      {!loading && !error && (
        <>
          <div className={`classes-grid ${view === "list" ? "is-list" : ""}`}>
            {filteredClasses.map((item) => {
              const color = classColor(item.id);
              const teacherName = getTeacherName(item);
              const expanded = selectedId === item.id;

              return (
                <article className="classes-card" key={item.id}>
                  <div className="classes-card-top">
                    <span className={`classes-icon classes-${color}`}>
                      <BookOpen size={22} strokeWidth={1.7} />
                    </span>

                    <span className="classes-status">
                      <span />
                      Active
                    </span>
                  </div>

                  <h3>{item.name}</h3>

                  <p className="classes-subject">
                    {item.subject || "Subject not assigned"}
                  </p>

                  <div className="classes-teacher">
                    <span className={`classes-avatar classes-${color}`}>
                      {initials(teacherName)}
                    </span>

                    <span>
                      <strong>{teacherName}</strong>
                      <small>Class teacher</small>
                    </span>
                  </div>

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

                  {/* Class actions */}

                  {/* Class actions */}
                  <div className="classes-card-actions">
                    <button
                      type="button"
                      className="classes-details-button"
                      aria-expanded={expanded}
                      onClick={() => toggleDetails(item.id)}
                    >
                      <span>
                        {expanded ? "Hide class details" : "View class details"}
                      </span>
                      <ArrowRight size={16} />
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        className="classes-edit-button"
                        aria-label={`Edit ${item.name}`}
                        title="Edit class"
                        onClick={() => openEditModal(item)}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* EMPTY STATE */}

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

          {/* PAGINATION */}

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
          SHARED CREATE / EDIT MODAL
      ===================================================== */}

      {modalOpen && isAdmin && (
        <div
          className="classes-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <section
            className="classes-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-form-heading"
          >
            <div className="classes-modal-header">
              <div>
                <h2 id="class-form-heading">
                  {isEditing ? "Edit class" : "Create new class"}
                </h2>

                <p>
                  {isEditing
                    ? "Update class information."
                    : "Add a new class to ClassFlow."}
                </p>
              </div>

              <button
                type="button"
                aria-label="Close"
                disabled={submitting}
                onClick={closeModal}
              >
                <X size={20} />
              </button>
            </div>

            <form
              key={isEditing ? editingClass?.id : "new-class"}
              onSubmit={handleSubmitClass}
            >
              <label>
                Class name
                <input
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={editingClass?.name ?? ""}
                  placeholder="e.g. Mathematics 10A3"
                />
              </label>

              <label>
                Subject
                <input
                  name="subject"
                  maxLength={120}
                  defaultValue={editingClass?.subject ?? ""}
                  placeholder="e.g. Mathematics"
                />
              </label>

              <label>
                Teacher
                <select
                  name="teacherId"
                  required
                  defaultValue={editingClass?.teacherId ?? ""}
                  disabled={loadingTeachers || teacherOptions.length === 0}
                >
                  <option value="">
                    {loadingTeachers
                      ? "Loading teachers..."
                      : "Select a teacher"}
                  </option>

                  {teacherOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.fullName}
                      {option.employeeCode ? ` (${option.employeeCode})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              {teacherError && <p role="alert">{teacherError}</p>}

              {!loadingTeachers &&
                !teacherError &&
                teacherOptions.length === 0 && (
                  <p>No teacher profiles available.</p>
                )}

              <label>
                Room
                <input
                  name="room"
                  maxLength={100}
                  defaultValue={editingClass?.room ?? ""}
                  placeholder="e.g. Room 201"
                />
              </label>

              <label>
                Description
                <textarea
                  name="description"
                  maxLength={2000}
                  rows={3}
                  defaultValue={editingClass?.description ?? ""}
                  placeholder="Class description..."
                />
              </label>

              {formError && <p role="alert">{formError}</p>}

              <div className="classes-modal-actions">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={closeModal}
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
                  {isEditing ? <Pencil size={16} /> : <Plus size={16} />}

                  {submitting
                    ? isEditing
                      ? "Saving..."
                      : "Creating..."
                    : isEditing
                      ? "Save changes"
                      : "Create class"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
