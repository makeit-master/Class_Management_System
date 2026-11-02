import { useEffect, useState, type FormEvent } from "react";

import {
  Check,
  Archive,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";

import { useAuth } from "../../auth/auth-context";

import {
  createStudent,
  getStudents,
  updateStudent,
  getStudentById,
  archiveStudent,
  restoreStudent,
  type CreateStudentInput,
  type StudentGender,
  type StudentListResponse,
  type StudentRecord,
  type UpdateStudentInput,
  type StudentDetail,
} from "./student-api";

import "./Students.css";

// ============================================================
// TYPES & CONSTANTS
// ============================================================

const PAGE_SIZE = 20;

const INITIAL_PAGINATION: StudentListResponse["pagination"] = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 0,
};

const AVATAR_COLORS = ["violet", "blue", "green", "orange", "pink"] as const;

type ModalMode = "create" | "edit" | null;

type StudentForm = {
  studentCode: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: StudentGender | "";
  parentName: string;
  parentPhone: string;
  address: string;
  notes: string;
};

const EMPTY_FORM: StudentForm = {
  studentCode: "",
  fullName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  parentName: "",
  parentPhone: "",
  address: "",
  notes: "",
};

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

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("vi-VN");
}

function optionalText(value: string): string | null {
  return value.trim() || null;
}

function toStudentForm(student: StudentRecord): StudentForm {
  return {
    studentCode: student.studentCode,
    fullName: student.fullName,
    email: student.email ?? "",
    phone: student.phone ?? "",
    dateOfBirth: student.dateOfBirth?.slice(0, 10) ?? "",
    gender: student.gender ?? "",
    parentName: student.parentName ?? "",
    parentPhone: student.parentPhone ?? "",
    address: student.address ?? "",
    notes: student.notes ?? "",
  };
}

function StudentAvatar({ student }: { student: StudentRecord }) {
  return (
    <span
      className={`students-avatar students-avatar-${studentColor(student.id)}`}
    >
      {initials(student.fullName)}
    </span>
  );
}

type StudentDetailViewProps = {
  student: StudentDetail | null;
  loading: boolean;
  error: string;
  isAdmin: boolean;
  onBack: () => void;
  onRetry: () => void;
  onEdit: (student: StudentRecord) => void;
};

function StudentDetailView({
  student,
  loading,
  error,
  isAdmin,
  onBack,
  onRetry,
  onEdit,
}: StudentDetailViewProps) {
  return (
    <div className="student-detail">
      <button type="button" className="students-back" onClick={onBack}>
        <ArrowLeft size={17} />
        Back to students
      </button>

      {loading && (
        <div className="students-panel student-detail-message" role="status">
          <RefreshCw size={24} />
          <p>Loading student profile...</p>
        </div>
      )}

      {!loading && error && (
        <div className="students-panel student-detail-message" role="alert">
          <h3>Unable to load student profile</h3>
          <p>{error}</p>

          <button type="button" className="students-btn" onClick={onRetry}>
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      )}

      {!loading && !error && student && (
        <>
          {/* PROFILE HEADER */}

          <section className="students-panel student-detail-header">
            <span
              className={`students-avatar students-avatar-large students-avatar-${studentColor(student.id)}`}
            >
              {initials(student.fullName)}
            </span>

            <div className="student-detail-identity">
              <h2>{student.fullName}</h2>

              <p>{student.studentCode}</p>

              <span className="students-status students-status-active">
                <i />
                Active
              </span>
            </div>

            {isAdmin && (
              <button
                type="button"
                className="students-btn students-btn-primary"
                onClick={() => onEdit(student)}
              >
                <Pencil size={16} />
                Edit Student
              </button>
            )}
          </section>

          <div className="student-detail-grid">
            {/* PERSONAL INFORMATION */}

            <section className="students-panel student-detail-section">
              <h3>
                <UserRound size={18} />
                Personal Information
              </h3>

              <dl className="student-detail-fields">
                <div>
                  <dt>Full name</dt>
                  <dd>{student.fullName}</dd>
                </div>

                <div>
                  <dt>Student code</dt>
                  <dd>{student.studentCode}</dd>
                </div>

                <div>
                  <dt>Date of birth</dt>
                  <dd>
                    {student.dateOfBirth
                      ? formatDate(student.dateOfBirth)
                      : "Not provided"}
                  </dd>
                </div>

                <div>
                  <dt>Gender</dt>
                  <dd>
                    {student.gender === "MALE"
                      ? "Male"
                      : student.gender === "FEMALE"
                        ? "Female"
                        : student.gender === "OTHER"
                          ? "Other"
                          : "Not specified"}
                  </dd>
                </div>

                <div>
                  <dt>Email</dt>
                  <dd>{student.email || "Not provided"}</dd>
                </div>

                <div>
                  <dt>Phone</dt>
                  <dd>{student.phone || "Not provided"}</dd>
                </div>

                <div className="student-detail-field-full">
                  <dt>Address</dt>
                  <dd>{student.address || "Not provided"}</dd>
                </div>
              </dl>
            </section>

            {/* GUARDIAN */}

            <section className="students-panel student-detail-section">
              <h3>
                <Phone size={18} />
                Parent / Guardian
              </h3>

              <dl className="student-detail-fields">
                <div>
                  <dt>Guardian name</dt>
                  <dd>{student.parentName || "Not provided"}</dd>
                </div>

                <div>
                  <dt>Guardian phone</dt>
                  <dd>{student.parentPhone || "Not provided"}</dd>
                </div>
              </dl>

              <div className="student-detail-divider" />

              <h3>
                <CalendarDays size={18} />
                Record Information
              </h3>

              <dl className="student-detail-fields">
                <div>
                  <dt>Created</dt>
                  <dd>{formatDate(student.createdAt)}</dd>
                </div>

                <div>
                  <dt>Last updated</dt>
                  <dd>{formatDate(student.updatedAt)}</dd>
                </div>
              </dl>
            </section>
          </div>

          {/* ENROLLMENTS */}

          <section className="students-panel student-detail-section">
            <div className="student-detail-section-heading">
              <h3>
                <BookOpen size={18} />
                Enrolled Classes
              </h3>

              <span className="students-count">
                {student.enrollments.length} classes
              </span>
            </div>

            {student.enrollments.length === 0 ? (
              <div className="student-detail-empty">
                <BookOpen size={26} />
                <p>This student is not enrolled in any active class.</p>
              </div>
            ) : (
              <div className="student-detail-class-list">
                {student.enrollments.map((enrollment) => (
                  <article className="student-detail-class" key={enrollment.id}>
                    <div>
                      <strong>{enrollment.class.name}</strong>

                      <p>
                        {enrollment.class.subject || "Subject not assigned"}
                      </p>
                    </div>

                    <div className="student-detail-class-meta">
                      <span>
                        <UserRound size={14} />
                        {enrollment.class.teacher.user.fullName}
                      </span>

                      <span>
                        <MapPin size={14} />
                        {enrollment.class.room || "Room not assigned"}
                      </span>

                      <span>
                        <CalendarDays size={14} />
                        Enrolled {formatDate(enrollment.enrolledAt)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* NOTES */}

          <section className="students-panel student-detail-section">
            <h3>
              <Pencil size={18} />
              Student Notes
            </h3>

            <p className="student-detail-notes">
              {student.notes || "No notes have been added."}
            </p>
          </section>
        </>
      )}
    </div>
  );
}

// ============================================================
// STUDENTS PAGE
// ============================================================

export default function StudentsPage() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  // ----------------------------------------------------------
  // STUDENT LIST
  // ----------------------------------------------------------

  const [students, setStudents] = useState<StudentRecord[]>([]);

  const [pagination, setPagination] =
    useState<StudentListResponse["pagination"]>(INITIAL_PAGINATION);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // ----------------------------------------------------------
  // SEARCH & PAGINATION
  // ----------------------------------------------------------

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [studentStatus, setStudentStatus] = useState<"active" | "archived">(
    "active",
  );

  // ----------------------------------------------------------
  // CREATE / EDIT MODAL
  // ----------------------------------------------------------

  const [modalMode, setModalMode] = useState<ModalMode>(null);

  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(
    null,
  );

  const [form, setForm] = useState<StudentForm>({ ...EMPTY_FORM });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");

  const isEditing = modalMode === "edit";

  // M16.5.4: Archive / Restore confirmation state.
  const [lifecycleTarget, setLifecycleTarget] = useState<StudentRecord | null>(
    null,
  );
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [lifecycleError, setLifecycleError] = useState("");

  // ----------------------------------------------------------
  // DETAIL
  // ----------------------------------------------------------
  const [detailId, setDetailId] = useState<string | null>(null);

  const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(
    null,
  );

  const [detailLoading, setDetailLoading] = useState(false);

  const [detailError, setDetailError] = useState("");

  const [detailRefreshKey, setDetailRefreshKey] = useState(0);

  // ==========================================================
  // EFFECT 1: DEBOUNCED SEARCH
  // ==========================================================

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [query]);

  // ==========================================================
  // EFFECT 2: LOAD STUDENTS FROM API
  // ==========================================================

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function loadStudents() {
      setLoading(true);
      setError("");

      try {
        const response = await getStudents(token!, {
          page,
          limit: PAGE_SIZE,
          search,
          status: isAdmin ? studentStatus : "active",
        });

        if (cancelled) return;

        setStudents(response.items);
        setPagination(response.pagination);
      } catch (caught) {
        if (cancelled) return;

        setStudents([]);
        setError(getErrorMessage(caught, "Unable to load students."));
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
  }, [token, page, search, refreshKey, studentStatus, isAdmin]);

  // ==========================================================
  // EFFECT 3: LOAD STUDENT DETAIL
  // ==========================================================

  useEffect(() => {
    if (!detailId || !token) return;

    let cancelled = false;

    async function loadStudentDetail() {
      setDetailLoading(true);
      setDetailError("");
      setStudentDetail(null);

      try {
        const result = await getStudentById(token!, detailId!);

        if (cancelled) return;

        setStudentDetail(result);
      } catch (caught) {
        if (cancelled) return;

        setDetailError(
          getErrorMessage(caught, "Unable to load student profile."),
        );
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    void loadStudentDetail();

    return () => {
      cancelled = true;
    };
  }, [token, detailId, detailRefreshKey]);

  // ==========================================================
  // HANDLERS
  // ==========================================================

  function refreshStudents() {
    setRefreshKey((previous) => previous + 1);
  }

  function changeStudentStatus(status: "active" | "archived") {
    if (!isAdmin && status === "archived") return;
    setStudentStatus(status);
    setPage(1);
    setQuery("");
    setSearch("");
    setError("");
  }

  function openLifecycleModal(student: StudentRecord) {
    if (!isAdmin) return;
    setMessage("");
    setLifecycleError("");
    setLifecycleTarget(student);
  }

  function closeLifecycleModal() {
    if (lifecycleBusy) return;
    setLifecycleTarget(null);
    setLifecycleError("");
  }

  async function confirmLifecycleChange() {
    if (!isAdmin || !token || !lifecycleTarget || lifecycleBusy) return;

    const target = lifecycleTarget;
    const restoring = Boolean(target.archivedAt);

    setLifecycleBusy(true);
    setLifecycleError("");

    try {
      if (restoring) {
        await restoreStudent(token, target.id);
      } else {
        await archiveStudent(token, target.id);
      }

      setLifecycleTarget(null);
      setMessage(
        restoring
          ? `Restored ${target.fullName} successfully.`
          : `Archived ${target.fullName} successfully.`,
      );

      // When removing the last row of a non-first page, move back one page.
      // Otherwise, reload the current tab from the server.
      if (students.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      } else {
        refreshStudents();
      }
    } catch (caught) {
      // Keep the dialog open, so a failed request never looks successful.
      setLifecycleError(
        getErrorMessage(
          caught,
          restoring
            ? "Unable to restore student."
            : "Unable to archive student.",
        ),
      );
    } finally {
      setLifecycleBusy(false);
    }
  }

  function openCreateModal() {
    if (!isAdmin || studentStatus === "archived") return;

    setEditingStudent(null);
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setModalMode("create");
  }

  function openEditModal(student: StudentRecord) {
    if (!isAdmin || student.archivedAt) return;

    setEditingStudent(student);
    setForm(toStudentForm(student));
    setFormError("");
    setModalMode("edit");
  }

  function closeModal() {
    if (submitting) return;

    setModalMode(null);
    setEditingStudent(null);
    setFormError("");
  }

  function updateForm<K extends keyof StudentForm>(
    field: K,
    value: StudentForm[K],
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function refreshAfterSave() {
    setQuery("");
    setSearch("");
    setPage(1);
    refreshStudents();
    setDetailRefreshKey((previous) => previous + 1);
  }

  function openStudentDetail(student: StudentRecord) {
    setStudentDetail(null);
    setDetailError("");
    setDetailId(student.id);
  }

  function closeStudentDetail() {
    setDetailId(null);
    setStudentDetail(null);
    setDetailError("");
  }

  function retryStudentDetail() {
    setDetailRefreshKey((previous) => previous + 1);
  }

  // ==========================================================
  // CREATE / UPDATE STUDENT
  // ==========================================================

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !isAdmin || submitting) return;

    const fullName = form.fullName.trim();
    const studentCode = form.studentCode.trim();

    if (fullName.length < 2) {
      setFormError("Student name must contain at least 2 characters.");
      return;
    }

    if (!isEditing && !/^STU[0-9]{4,}$/.test(studentCode)) {
      setFormError("Student code must follow STU0001 format.");
      return;
    }

    const sharedInput = {
      fullName,
      email: optionalText(form.email),
      phone: optionalText(form.phone),
      dateOfBirth: optionalText(form.dateOfBirth),
      gender: form.gender || null,
      parentName: optionalText(form.parentName),
      parentPhone: optionalText(form.parentPhone),
      address: optionalText(form.address),
      notes: optionalText(form.notes),
    };

    setSubmitting(true);
    setFormError("");

    try {
      if (isEditing) {
        if (!editingStudent) {
          throw new Error("No student selected for editing.");
        }

        const input: UpdateStudentInput = sharedInput;

        await updateStudent(token, editingStudent.id, input);

        setMessage("Student updated successfully.");
      } else {
        const input: CreateStudentInput = {
          ...sharedInput,
          studentCode,
        };

        await createStudent(token, input);

        setMessage("Student created successfully.");
      }

      setModalMode(null);
      setEditingStudent(null);
      refreshAfterSave();
    } catch (caught) {
      setFormError(
        getErrorMessage(
          caught,
          isEditing ? "Unable to update student." : "Unable to create student.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ==========================================================
  // PAGINATION
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
      {/* SUCCESS MESSAGE */}

      {message && (
        <div className="students-toast" role="status">
          <span>{message}</span>

          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setMessage("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {detailId ? (
        <StudentDetailView
          student={studentDetail}
          loading={detailLoading}
          error={detailError}
          isAdmin={isAdmin}
          onBack={closeStudentDetail}
          onRetry={retryStudentDetail}
          onEdit={openEditModal}
        />
      ) : (
        <>
          {/* HEADER */}

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
                onClick={refreshStudents}
                disabled={loading}
              >
                <RefreshCw size={16} />
                Refresh
              </button>

              {isAdmin && studentStatus === "active" && (
                <button
                  type="button"
                  className="students-btn students-btn-primary"
                  onClick={openCreateModal}
                >
                  <Plus size={17} />
                  Add Student
                </button>
              )}
            </div>
          </div>

          {/* ACTIVE / ARCHIVED TABS */}
          {isAdmin && (
            <div
              className="students-status-tabs"
              role="group"
              aria-label="Student status filter"
            >
              <button
                type="button"
                className={`students-status-tab ${studentStatus === "active" ? "is-active" : ""}`}
                aria-pressed={studentStatus === "active"}
                onClick={() => changeStudentStatus("active")}
              >
                Active Students
              </button>
              <button
                type="button"
                className={`students-status-tab ${studentStatus === "archived" ? "is-active" : ""}`}
                aria-pressed={studentStatus === "archived"}
                onClick={() => changeStudentStatus("archived")}
              >
                Archived Students
              </button>
            </div>
          )}

          {/* TABLE PANEL */}

          <div className="students-panel students-table-panel">
            <div className="students-filters">
              <label className="students-search">
                <Search size={17} />

                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by name or student code..."
                  aria-label="Search students"
                />
              </label>

              <span className="students-results">
                {loading ? "Loading..." : `${total} results`}
              </span>
            </div>

            {/* LOADING */}

            {loading && (
              <div className="students-empty" role="status">
                <RefreshCw size={24} />
                <p>Loading students from ClassFlow...</p>
              </div>
            )}

            {/* ERROR */}

            {!loading && error && (
              <div className="students-empty" role="alert">
                <h3>Unable to load students</h3>
                <p>{error}</p>

                <button
                  type="button"
                  className="students-btn"
                  onClick={refreshStudents}
                >
                  <RefreshCw size={16} />
                  Try again
                </button>
              </div>
            )}

            {/* TABLE */}

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
                        {isAdmin && <th>Actions</th>}
                      </tr>
                    </thead>

                    <tbody>
                      {students.map((student) => (
                        <tr key={student.id}>
                          <td>
                            {student.archivedAt ? (
                              <div className="students-person">
                                <StudentAvatar student={student} />
                                <span>
                                  <b>{student.fullName}</b>
                                  <small>
                                    <Mail size={12} />
                                    {student.email || "No email"}
                                  </small>
                                </span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="students-person students-person-link"
                                onClick={() => openStudentDetail(student)}
                                aria-label={`View profile of ${student.fullName}`}
                              >
                                <StudentAvatar student={student} />
                                <span>
                                  <b>{student.fullName}</b>
                                  <small>
                                    <Mail size={12} />
                                    {student.email || "No email"}
                                  </small>
                                </span>
                              </button>
                            )}
                          </td>

                          <td className="students-muted">
                            {student.studentCode}
                          </td>

                          <td className="students-muted">
                            {student.phone || "Not provided"}
                          </td>

                          <td>
                            <span className="students-class-pill">
                              {student._count.enrollments}{" "}
                              {student._count.enrollments === 1
                                ? "class"
                                : "classes"}
                            </span>
                          </td>

                          <td className="students-muted">
                            {formatDate(student.createdAt)}
                          </td>

                          <td>
                            <span
                              className={`students-status ${student.archivedAt ? "students-status-archived" : "students-status-active"}`}
                            >
                              <i />
                              {student.archivedAt ? "Archived" : "Active"}
                            </span>
                          </td>

                          {isAdmin && (
                            <td>
                              <div className="students-row-actions">
                                {!student.archivedAt && (
                                  <button
                                    type="button"
                                    className="students-icon-btn"
                                    aria-label={`Edit ${student.fullName}`}
                                    title="Edit student"
                                    onClick={() => openEditModal(student)}
                                    disabled={lifecycleBusy}
                                  >
                                    <Pencil size={17} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="students-icon-btn students-lifecycle-action"
                                  aria-label={`${student.archivedAt ? "Restore" : "Archive"} ${student.fullName}`}
                                  title={
                                    student.archivedAt
                                      ? "Restore student"
                                      : "Archive student"
                                  }
                                  onClick={() => openLifecycleModal(student)}
                                  disabled={lifecycleBusy}
                                >
                                  {student.archivedAt ? (
                                    <RotateCcw size={17} />
                                  ) : (
                                    <Archive size={17} />
                                  )}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {students.length === 0 && (
                    <div className="students-empty">
                      <Users size={26} />
                      <h3>No students found</h3>
                      <p>
                        {search
                          ? "Try another name or student code."
                          : isAdmin && studentStatus === "archived"
                            ? "No archived students found."
                            : isAdmin
                              ? "No active students have been added yet."
                              : "No students are assigned to your classes."}
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
                      onClick={() =>
                        setPage((current) => Math.max(1, current - 1))
                      }
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
                      onClick={() =>
                        setPage((current) => Math.min(totalPages, current + 1))
                      }
                    >
                      Next
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
      {/* =====================================================
          ARCHIVE / RESTORE CONFIRMATION (ADMIN ONLY)
          ===================================================== */}

      {lifecycleTarget && isAdmin && (
        <div
          className="students-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeLifecycleModal();
          }}
        >
          <section
            className="students-modal students-confirm students-lifecycle-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="students-lifecycle-title"
            aria-describedby="students-lifecycle-description"
          >
            {lifecycleTarget.archivedAt ? (
              <RotateCcw size={28} className="students-lifecycle-icon" />
            ) : (
              <Archive size={28} className="students-lifecycle-icon" />
            )}

            <h3 id="students-lifecycle-title">
              {lifecycleTarget.archivedAt
                ? "Restore student?"
                : "Archive student?"}
            </h3>

            <p id="students-lifecycle-description">
              {lifecycleTarget.archivedAt ? (
                <>
                  Restore <strong>{lifecycleTarget.fullName}</strong> to the
                  Active Students list? Their student code and learning records
                  stay unchanged.
                </>
              ) : (
                <>
                  Archive <strong>{lifecycleTarget.fullName}</strong>? Their
                  profile will be hidden from Active Students, but no student,
                  enrollment, attendance, or grade records will be deleted.
                </>
              )}
            </p>

            {lifecycleError && (
              <p className="students-form-error" role="alert">
                {lifecycleError}
              </p>
            )}

            <div className="students-modal-actions">
              <button
                type="button"
                className="students-btn"
                onClick={closeLifecycleModal}
                disabled={lifecycleBusy}
              >
                Cancel
              </button>

              <button
                type="button"
                className="students-btn students-btn-primary"
                onClick={() => void confirmLifecycleChange()}
                disabled={lifecycleBusy}
              >
                {lifecycleTarget.archivedAt ? (
                  <RotateCcw size={16} />
                ) : (
                  <Archive size={16} />
                )}
                {lifecycleBusy
                  ? "Saving..."
                  : lifecycleTarget.archivedAt
                    ? "Restore student"
                    : "Archive student"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================
          CREATE / EDIT MODAL
          ===================================================== */}

      {modalMode && isAdmin && (
        <div
          className="students-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <section
            className="students-modal students-student-form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="students-form-title"
          >
            <div className="students-modal-title">
              <div>
                <h3 id="students-form-title">
                  {isEditing ? "Edit student" : "Add new student"}
                </h3>

                <p>
                  {isEditing
                    ? "Update student profile information."
                    : "Create a new student profile in ClassFlow."}
                </p>
              </div>

              <button
                type="button"
                className="students-icon-btn"
                aria-label="Close dialog"
                disabled={submitting}
                onClick={closeModal}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="students-form-grid">
                <label>
                  Student Code *
                  <input
                    value={form.studentCode}
                    onChange={(event) =>
                      updateForm(
                        "studentCode",
                        event.target.value.toUpperCase(),
                      )
                    }
                    placeholder="STU0001"
                    maxLength={30}
                    required
                    disabled={isEditing || submitting}
                  />
                </label>

                <label>
                  Full Name *
                  <input
                    value={form.fullName}
                    onChange={(event) =>
                      updateForm("fullName", event.target.value)
                    }
                    placeholder="Student full name"
                    minLength={2}
                    maxLength={120}
                    required
                    disabled={submitting}
                  />
                </label>

                <label>
                  Email
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      updateForm("email", event.target.value)
                    }
                    placeholder="student@example.com"
                    maxLength={255}
                    disabled={submitting}
                  />
                </label>

                <label>
                  Phone
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) =>
                      updateForm("phone", event.target.value)
                    }
                    placeholder="Phone number"
                    maxLength={20}
                    disabled={submitting}
                  />
                </label>

                <label>
                  Date of Birth
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(event) =>
                      updateForm("dateOfBirth", event.target.value)
                    }
                    disabled={submitting}
                  />
                </label>

                <label>
                  Gender
                  <select
                    value={form.gender}
                    onChange={(event) =>
                      updateForm(
                        "gender",
                        event.target.value as StudentForm["gender"],
                      )
                    }
                    disabled={submitting}
                  >
                    <option value="">Not specified</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>

                <label>
                  Parent / Guardian Name
                  <input
                    value={form.parentName}
                    onChange={(event) =>
                      updateForm("parentName", event.target.value)
                    }
                    placeholder="Guardian name"
                    maxLength={120}
                    disabled={submitting}
                  />
                </label>

                <label>
                  Parent / Guardian Phone
                  <input
                    type="tel"
                    value={form.parentPhone}
                    onChange={(event) =>
                      updateForm("parentPhone", event.target.value)
                    }
                    placeholder="Guardian phone"
                    maxLength={20}
                    disabled={submitting}
                  />
                </label>

                <label className="students-form-full">
                  Address
                  <input
                    value={form.address}
                    onChange={(event) =>
                      updateForm("address", event.target.value)
                    }
                    placeholder="Student address"
                    maxLength={500}
                    disabled={submitting}
                  />
                </label>

                <label className="students-form-full">
                  Notes
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(event) =>
                      updateForm("notes", event.target.value)
                    }
                    placeholder="Additional student information..."
                    maxLength={2000}
                    disabled={submitting}
                  />
                </label>
              </div>

              {formError && (
                <p className="students-form-error" role="alert">
                  {formError}
                </p>
              )}

              <div className="students-modal-actions">
                <button
                  type="button"
                  className="students-btn"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="students-btn students-btn-primary"
                  disabled={submitting}
                >
                  {isEditing ? <Pencil size={16} /> : <Check size={16} />}

                  {submitting
                    ? "Saving..."
                    : isEditing
                      ? "Save Changes"
                      : "Add Student"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
